import React, { useMemo } from 'react';
import { maskPhoneForRls } from '../utils/saasLogic';


export interface UseProtectedPIIInput {
  rawPhone: string;
  telegramUsername?: string;
  ownerPartnerId: string;
  viewerPartnerId: string;
  scriptText: string;
}

export interface UseProtectedPIIResult {
  displayPhone: string;
  displayTelegram: string;
  isMasked: boolean;
  canContactDirectly: boolean;
  rlsPolicyStatusLabel: string;
  buildTelegramShareUrl: () => string | null;
  openInTelegramNativeSdk: () => boolean;
}

/**
 * Хук защиты клиентской базы (Privacy by Design / Supabase RLS crm_leads_pii):
 * Маскирует номер телефона (+7 *** ***-**-10) и скрывает Telegram-юзернейм,
 * если карточку просматривает вышестоящий наставник, а не непосредственный владелец клиента.
 */
export function useProtectedPII({
  rawPhone,
  telegramUsername,
  ownerPartnerId,
  viewerPartnerId,
  scriptText,
}: UseProtectedPIIInput): UseProtectedPIIResult {
  return useMemo(() => {
    const { displayPhone, isMasked } = maskPhoneForRls(
      rawPhone,
      ownerPartnerId,
      viewerPartnerId
    );

    const displayTelegram = isMasked
      ? '@***_скрыто_RLS'
      : telegramUsername
        ? `@${telegramUsername.replace(/^@/, '')}`
        : 'Telegram по номеру';

    const canContactDirectly = !isMasked;

    const rlsPolicyStatusLabel = isMasked
      ? 'RLS: Просмотр наставника (PII скрыты от увода базы)'
      : 'RLS: Вы владелец клиента (полный доступ к контакту)';

    const buildTelegramShareUrl = (): string | null => {
      if (isMasked) return null;
      const encodedText = encodeURIComponent(scriptText);
      if (telegramUsername) {
        const cleanUser = telegramUsername.replace(/^@/, '');
        return `https://t.me/${cleanUser}?text=${encodedText}`;
      }
      return `https://t.me/share/url?url=&text=${encodedText}`;
    };

    /**
     * Шаг 4 (Zero-Chat Архитектура): Нативный метод Telegram Mini Apps SDK
     * для мгновенного переброса партнёра в личный диалог с клиентом
     */
    const openInTelegramNativeSdk = (): boolean => {
      const targetUrl = buildTelegramShareUrl();
      if (!targetUrl) return false;

      if (typeof window !== 'undefined' && window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.HapticFeedback?.notificationOccurred?.('success');
        window.Telegram.WebApp.openTelegramLink(targetUrl);
        return true;
      }
      return true;
    };

    return {
      displayPhone,
      displayTelegram,
      isMasked,
      canContactDirectly,
      rlsPolicyStatusLabel,
      buildTelegramShareUrl,
      openInTelegramNativeSdk,
    };
  }, [rawPhone, telegramUsername, ownerPartnerId, viewerPartnerId, scriptText]);
}

/**
 * HOC-обёртка withProtectedPII для компонентов карточек сделок и задач
 */
export function withProtectedPII<
  P extends {
    rawPhone: string;
    telegramUsername?: string;
    ownerPartnerId: string;
    viewerPartnerId: string;
    scriptText: string;
  }
>(WrappedComponent: React.ComponentType<P & { pii: UseProtectedPIIResult }>) {
  const ComponentWithPII: React.FC<P> = (props) => {
    const pii = useProtectedPII({
      rawPhone: props.rawPhone,
      telegramUsername: props.telegramUsername,
      ownerPartnerId: props.ownerPartnerId,
      viewerPartnerId: props.viewerPartnerId,
      scriptText: props.scriptText,
    });
    return React.createElement(WrappedComponent, { ...props, pii });
  };
  return ComponentWithPII;
}
