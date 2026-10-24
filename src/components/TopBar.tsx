import React from 'react';
import { RefreshCw, ShieldCheck, Globe, Coins } from 'lucide-react';
import { OrganizationNode } from '../types/database';
import { useLocale, SupportedLocale, SupportedCurrency } from '../i18n/LocaleContext';

interface TopBarProps {
  companyName: string;
  currentProfile: OrganizationNode | null;
  activeChatId: string | null;
  isSyncing: boolean;
  onRefresh: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  companyName,
  currentProfile,
  isSyncing,
  onRefresh,
}) => {
  const { locale, currency, setLocale, setCurrency, t } = useLocale();

  const locales: SupportedLocale[] = ['ru', 'en'];
  const currencies: SupportedCurrency[] = ['RUB', 'USD', 'EUR'];

  return (
    <header className="h-14 border-b border-[#1F1F1F] bg-[#0D0D0D]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-20 font-sans">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-xs font-medium text-[#71717A] whitespace-nowrap">
          {t('topbar.workspace')}
        </span>
        <span className="text-[#2E2E2E]">/</span>
        <span className="text-xs font-semibold text-white tracking-tight truncate">
          {companyName}
        </span>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        {/* Language Switcher (RU | EN) */}
        <div className="inline-flex items-center rounded-lg border border-[#262626] bg-[#141414] p-0.5">
          <Globe className="w-3 h-3 text-[#71717A] ml-2 mr-1" />
          {locales.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocale(loc)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold uppercase transition-colors ${
                locale === loc
                  ? 'bg-white text-black'
                  : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              {loc}
            </button>
          ))}
        </div>

        {/* Currency Switcher (RUB | USD | EUR) */}
        <div className="inline-flex items-center rounded-lg border border-[#262626] bg-[#141414] p-0.5">
          <Coins className="w-3 h-3 text-[#71717A] ml-2 mr-1" />
          {currencies.map((curr) => (
            <button
              key={curr}
              type="button"
              onClick={() => setCurrency(curr)}
              className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors ${
                currency === curr
                  ? 'bg-white text-black'
                  : 'text-[#8E8E93] hover:text-white'
              }`}
            >
              {curr}
            </button>
          ))}
        </div>

        {/* Current User Badge with Free-form Job Title */}
        {currentProfile && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#141414] text-xs">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="text-white font-medium whitespace-nowrap">
              {currentProfile.name}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded bg-[#222222] text-[#D4D4D8] whitespace-nowrap">
              {currentProfile.role_type}
            </span>
          </div>
        )}

        <button
          onClick={onRefresh}
          disabled={isSyncing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262626] bg-[#141414] hover:bg-[#1C1C1C] text-xs font-medium text-[#D4D4D8] transition-colors disabled:opacity-50 whitespace-nowrap"
          title={t('topbar.sync')}
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${
              isSyncing ? 'animate-spin text-white' : 'text-[#8E8E93]'
            }`}
          />
          <span className="hidden sm:inline">{t('topbar.sync')}</span>
        </button>
      </div>
    </header>
  );
};
