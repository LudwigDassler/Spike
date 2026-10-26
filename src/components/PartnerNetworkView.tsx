import React, { useState } from 'react';
import { PartnerNode, WhiteLabelPreset } from '../types/saas';
import { determinePartnerRank } from '../utils/saasLogic';

interface PartnerNetworkViewProps {
  partners: PartnerNode[];
  activePreset: WhiteLabelPreset;
  onAddPartnerVolume: (partnerId: string, addedPv: number) => void;
  onAdvanceOnboardingStep: (partnerId: string) => void;
  onRegisterNewPartner: (name: string, city: string, uplineName: string) => void;
  onAssignTaskToPartner: (partnerName: string) => void;
}

export const PartnerNetworkView: React.FC<PartnerNetworkViewProps> = ({
  partners,
  activePreset,
  onAddPartnerVolume,
  onAdvanceOnboardingStep,
  onRegisterNewPartner,
  onAssignTaskToPartner,
}) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [newPartnerName, setNewPartnerName] = useState('');
  const [newPartnerCity, setNewPartnerCity] = useState('Краснодар');
  const [uplineName, setUplineName] = useState(partners[0]?.name || 'Алина Соколова');
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPartnerName.trim()) {
      setErrorMsg('Введите ФИО нового Независимого Партнёра.');
      return;
    }
    onRegisterNewPartner(newPartnerName.trim(), newPartnerCity.trim() || 'Москва', uplineName);
    setNewPartnerName('');
    setErrorMsg('');
    setIsRegisterOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Спонсорская структура · {activePreset.brandName} · Дубликация бизнес-процессов
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Партнёрская сеть, онбординг и квалификация ступеней
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsRegisterOpen(!isRegisterOpen)}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors self-start whitespace-nowrap shrink-0"
        >
          {isRegisterOpen ? 'Скрыть форму регистрации' : '+ Подключить нового партнёра'}
        </button>
      </div>

      {/* Register Partner Inline Form */}
      {isRegisterOpen && (
        <form
          onSubmit={handleRegisterSubmit}
          className="p-5 bg-white border border-slate-200 rounded-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">
              Подключение нового партнёра (автоматическое создание стартовых задач)
            </h2>
            <span className="text-xs text-slate-500">
              Стартовый план: 500 PV за 14 дней
            </span>
          </div>

          {errorMsg && (
            <div
              role="alert"
              className="p-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded"
            >
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label
                htmlFor="partner-reg-name"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                ФИО нового партнёра *
              </label>
              <input
                id="partner-reg-name"
                type="text"
                value={newPartnerName}
                onChange={(e) => {
                  setNewPartnerName(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="Например: Виктор Орлов"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label
                htmlFor="partner-reg-city"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Город / Клуб ЗОЖ
              </label>
              <input
                id="partner-reg-city"
                type="text"
                value={newPartnerCity}
                onChange={(e) => setNewPartnerCity(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label
                htmlFor="partner-reg-upline"
                className="block text-xs font-semibold text-slate-700 mb-1"
              >
                Вышестоящий спонсор (Наставник)
              </label>
              <select
                id="partner-reg-upline"
                value={uplineName}
                onChange={(e) => setUplineName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Зарегистрировать и выдать чек-лист запуска
            </button>
          </div>
        </form>
      )}

      {/* Qualification Ladder Explanation Bar */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <div className="text-xs font-semibold text-slate-900">1. Консультант (25%)</div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            0 – 499 PV · Старт онбординга
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-900">2. Старший консультант (35%)</div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            500 – 2 499 PV · Первые 5–7 клиентов
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-slate-900">3. Успешный строитель (42%)</div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            2 500 – 3 999 PV · Командный марафон
          </div>
        </div>
        <div>
          <div className="text-xs font-semibold text-emerald-800">4. Супервайзор (50% + Роялти)</div>
          <div className="text-xs text-slate-500 tabular-nums mt-0.5">
            4 000+ PV · Лидер партнёрской ветки
          </div>
        </div>
      </div>

      {/* Partner Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {partners.map((partner) => {
          const totalPv = partner.personalPv + partner.groupPv;
          const currentRank = determinePartnerRank(totalPv);
          const onboardingPct = Math.round(
            (partner.onboardingCompletedSteps / partner.onboardingTotalSteps) * 100
          );

          return (
            <article
              key={partner.id}
              className="p-5 bg-white border border-slate-200 rounded-lg flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="text-base font-bold text-slate-900">{partner.name}</h2>
                  <span className="text-xs font-semibold text-emerald-800 tabular-nums">
                    {currentRank}
                  </span>
                </div>

                {/* Clean Business Metadata (No raw technical paths) */}
                <div className="mt-1 text-xs text-slate-500">
                  Город: {partner.city} · Наставник: {partner.uplineName} · В сети с{' '}
                  <span className="tabular-nums">{partner.joinedDate}</span>
                </div>

                {/* Volume Metrics */}
                <div className="mt-4 pt-3 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500">Личный объём</div>
                    <div className="tabular-nums font-semibold text-slate-900 mt-0.5">
                      {partner.personalPv.toLocaleString('ru-RU')} PV
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Групповой объём</div>
                    <div className="tabular-nums font-semibold text-slate-900 mt-0.5">
                      {partner.groupPv.toLocaleString('ru-RU')} PV
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Клиентов в CRM</div>
                    <div className="tabular-nums font-semibold text-emerald-700 mt-0.5">
                      {partner.activeClients} чел.
                    </div>
                  </div>
                </div>

                {/* Onboarding Checklist Progress */}
                <div className="mt-4 pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-600 font-medium">
                      Прогресс стартового онбординга партнёра
                    </span>
                    <span className="tabular-nums font-semibold text-slate-900">
                      {partner.onboardingCompletedSteps}/{partner.onboardingTotalSteps} ({onboardingPct}%)
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-700 transition-all duration-200"
                      style={{ width: `${onboardingPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Partner Interactive Actions */}
              <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onAddPartnerVolume(partner.id, 150)}
                    className="px-2.5 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors tabular-nums whitespace-nowrap shrink-0"
                  >
                    +150 PV заказа
                  </button>

                  {partner.onboardingCompletedSteps < partner.onboardingTotalSteps && (
                    <button
                      type="button"
                      onClick={() => onAdvanceOnboardingStep(partner.id)}
                      className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                    >
                      Зачесть шаг онбординга
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onAssignTaskToPartner(partner.name)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-100 border border-slate-300 rounded-md transition-colors whitespace-nowrap shrink-0"
                >
                  Поставить задачу →
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
