import React from 'react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { ThemePreference, useLocale } from '../i18n/LocaleContext';

/**
 * Personal interface preferences: theme (light / dark / follow the OS) and language.
 * Stored per browser in localStorage via LocaleContext.
 */
export const AppearanceSettings: React.FC = () => {
  const { language, setLanguage, themePreference, setThemePreference } = useLocale();
  const isEn = language === 'en';
  let systemTheme: 'light' | 'dark' = 'dark';
  try {
    systemTheme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  } catch {}

  const themeOptions: Array<{
    id: ThemePreference;
    label: string;
    hint: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      id: 'light',
      label: isEn ? 'Light' : 'Светлая',
      hint: isEn ? 'Bright background' : 'Светлый фон',
      icon: Sun,
    },
    {
      id: 'dark',
      label: isEn ? 'Dark' : 'Тёмная',
      hint: isEn ? 'Easy on the eyes' : 'Меньше нагрузки на глаза',
      icon: Moon,
    },
    {
      id: 'system',
      label: isEn ? 'System' : 'Как в системе',
      hint: isEn
        ? `System is ${systemTheme}`
        : `В системе: ${systemTheme === 'light' ? 'светлая' : 'тёмная'}`,
      icon: Monitor,
    },
  ];

  return (
    <section
      aria-labelledby="tc-appearance-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 dark:border-white/[0.08] dark:bg-[#111115]"
    >
      <h3 id="tc-appearance-title" className="text-sm font-semibold text-slate-900 dark:text-white">
        {isEn ? 'Appearance' : 'Оформление'}
      </h3>
      <p className="mt-0.5 text-xs text-slate-600 dark:text-zinc-400">
        {isEn
          ? 'Applies only to this browser. Shortcut toggle is also available in the top bar.'
          : 'Настройка сохраняется в этом браузере. Быстрое переключение — кнопкой в верхней панели.'}
      </p>

      <div
        role="radiogroup"
        aria-label={isEn ? 'Theme' : 'Тема'}
        className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5"
      >
        {themeOptions.map((opt) => {
          const Icon = opt.icon;
          const active = themePreference === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setThemePreference(opt.id)}
              className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left cursor-pointer transition-colors ${
                active
                  ? 'border-indigo-500 bg-indigo-50 ring-1 ring-inset ring-indigo-500 dark:border-indigo-400 dark:bg-indigo-500/10 dark:ring-indigo-400'
                  : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:border-white/10 dark:hover:border-white/20 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  active
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-100 text-slate-600 dark:bg-white/[0.06] dark:text-zinc-300'
                }`}
              >
                <Icon className="w-4 h-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                  {opt.label}
                </span>
                <span className="block text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                  {opt.hint}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-white/[0.06]">
        <div>
          <div className="text-xs font-semibold text-slate-900 dark:text-white">
            {isEn ? 'Interface language' : 'Язык интерфейса'}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-zinc-400">
            {isEn ? 'Dates and amounts follow the language.' : 'Форматы дат и сумм следуют языку.'}
          </div>
        </div>
        <div
          role="radiogroup"
          aria-label={isEn ? 'Language' : 'Язык'}
          className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-white/10 dark:bg-white/[0.04]"
        >
          {(
            [
              ['ru', 'Русский'],
              ['en', 'English'],
            ] as const
          ).map(([code, label]) => {
            const active = language === code;
            return (
              <button
                key={code}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setLanguage(code)}
                className={`h-8 px-3 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm dark:bg-white/[0.12] dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
};
