import React, { useState } from 'react';
import { ValuationInput, WhiteLabelPreset } from '../types/saas';
import { calculateSaasValuation } from '../utils/saasLogic';

interface EnterpriseExitViewProps {
  presets: WhiteLabelPreset[];
  activePreset: WhiteLabelPreset;
  onSelectPreset: (preset: WhiteLabelPreset) => void;
}

type ScenarioId = 'seed_branch' | 'regional_network' | 'enterprise_exit';

export const EnterpriseExitView: React.FC<EnterpriseExitViewProps> = ({
  presets,
  activePreset,
  onSelectPreset,
}) => {
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('regional_network');
  const [valuationInput, setValuationInput] = useState<ValuationInput>({
    activePartnersCount: 1500,
    arpuMonthlyRub: 2490,
    corporateEnterpriseSeats: 600,
    corporateSeatPriceRub: 3900,
    monthlyChurnPercent: 1.8,
    cacRub: 3200,
    grossMarginPercent: 85,
  });

  const [pitchGenerated, setPitchGenerated] = useState(false);

  const metrics = calculateSaasValuation(valuationInput);

  const applyScenario = (scenario: ScenarioId) => {
    setActiveScenario(scenario);
    if (scenario === 'seed_branch') {
      setValuationInput({
        activePartnersCount: 350,
        arpuMonthlyRub: 1990,
        corporateEnterpriseSeats: 50,
        corporateSeatPriceRub: 3500,
        monthlyChurnPercent: 2.5,
        cacRub: 2800,
        grossMarginPercent: 82,
      });
    } else if (scenario === 'regional_network') {
      setValuationInput({
        activePartnersCount: 1500,
        arpuMonthlyRub: 2490,
        corporateEnterpriseSeats: 600,
        corporateSeatPriceRub: 3900,
        monthlyChurnPercent: 1.8,
        cacRub: 3200,
        grossMarginPercent: 85,
      });
    } else {
      setValuationInput({
        activePartnersCount: 6500,
        arpuMonthlyRub: 2790,
        corporateEnterpriseSeats: 3200,
        corporateSeatPriceRub: 4200,
        monthlyChurnPercent: 1.2,
        cacRub: 2400,
        grossMarginPercent: 88,
      });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Корпоративная монетизация · Модель Bottom-Up B2B2C · Подготовка к M&A сделке
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Стратегия продажи SaaS крупным партнёрским корпорациям
          </h1>
        </div>

        <div
          role="group"
          aria-label="Сценарии масштабирования SaaS"
          className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start shrink-0"
        >
          <button
            type="button"
            onClick={() => applyScenario('seed_branch')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeScenario === 'seed_branch'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Этап 1: 400 мест
          </button>
          <button
            type="button"
            onClick={() => applyScenario('regional_network')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeScenario === 'regional_network'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Этап 2: 2 100 мест
          </button>
          <button
            type="button"
            onClick={() => applyScenario('enterprise_exit')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeScenario === 'enterprise_exit'
                ? 'bg-white text-emerald-800 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Этап 3: M&A Экзит (9 700 мест)
          </button>
        </div>
      </div>

      {/* Top Valuation Readout Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Регулярная выручка (MRR / мес)</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {metrics.totalMrrRub.toLocaleString('ru-RU')} ₽
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Партнёры: {(metrics.partnerMrrRub / 1_000_000).toFixed(2)}M ₽ · B2B:{' '}
            {(metrics.corporateMrrRub / 1_000_000).toFixed(2)}M ₽
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Годовая выручка (ARR)</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {(metrics.arrRub / 1_000_000).toFixed(1)} млн ₽
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            Удержание NDR: {metrics.netDollarRetentionPercent}% в год
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Юнит-экономика (LTV / CAC)</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
            {metrics.ltvCacRatio}x
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            LTV: {metrics.ltvRub.toLocaleString('ru-RU')} ₽ · Оценка: {metrics.revenueMultiple}x ARR
          </div>
        </div>

        <div className="p-4 bg-slate-900 text-white border border-slate-900 rounded-lg">
          <div className="text-xs text-slate-300">Оценка SaaS для M&A продажи</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-white">
            {(metrics.enterpriseValuationRub / 1_000_000).toFixed(1)} млн ₽
          </div>
          <div className="mt-1 text-xs text-emerald-300 tabular-nums">
            ≈ ${metrics.enterpriseValuationUsd.toLocaleString('en-US')} USD
          </div>
        </div>
      </div>

      {/* Main Split: Calculator Controls + B2B2C Mechanics Explanation (Single-Elevation Containers) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive M&A & Unit Economics Simulator */}
        <section
          aria-label="Калькулятор капитализации SaaS"
          className="lg:col-span-7 p-6 bg-white border border-slate-200 rounded-lg space-y-6"
        >
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Калькулятор капитализации и юнит-экономики B2B2C SaaS
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Смоделируйте, как подключение независимых партнёров снизу вверх (Bottom-Up) формирует актив для продажи крупной корпорации:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label
                htmlFor="val-partners-count"
                className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span>Независимые партнёры (B2C)</span>
                <span className="tabular-nums text-emerald-700">
                  {valuationInput.activePartnersCount} чел.
                </span>
              </label>
              <input
                id="val-partners-count"
                type="range"
                min={100}
                max={10000}
                step={50}
                value={valuationInput.activePartnersCount}
                onChange={(e) =>
                  setValuationInput({
                    ...valuationInput,
                    activePartnersCount: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <label
                htmlFor="val-arpu-rub"
                className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span>Чек подписки партнёра (ARPU)</span>
                <span className="tabular-nums text-slate-900">
                  {valuationInput.arpuMonthlyRub.toLocaleString('ru-RU')} ₽/мес
                </span>
              </label>
              <input
                id="val-arpu-rub"
                type="range"
                min={990}
                max={5990}
                step={100}
                value={valuationInput.arpuMonthlyRub}
                onChange={(e) =>
                  setValuationInput({
                    ...valuationInput,
                    arpuMonthlyRub: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <label
                htmlFor="val-corp-seats"
                className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span>Корпоративные B2B-лицензии</span>
                <span className="tabular-nums text-emerald-700">
                  {valuationInput.corporateEnterpriseSeats} мест
                </span>
              </label>
              <input
                id="val-corp-seats"
                type="range"
                min={0}
                max={5000}
                step={50}
                value={valuationInput.corporateEnterpriseSeats}
                onChange={(e) =>
                  setValuationInput({
                    ...valuationInput,
                    corporateEnterpriseSeats: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-700"
              />
            </div>

            <div>
              <label
                htmlFor="val-churn"
                className="flex justify-between text-xs font-semibold text-slate-700 mb-1.5"
              >
                <span>Ежемесячный отток (Churn)</span>
                <span className="tabular-nums text-slate-900">
                  {valuationInput.monthlyChurnPercent}%
                </span>
              </label>
              <input
                id="val-churn"
                type="range"
                min={0.8}
                max={6.0}
                step={0.2}
                value={valuationInput.monthlyChurnPercent}
                onChange={(e) =>
                  setValuationInput({
                    ...valuationInput,
                    monthlyChurnPercent: Number(e.target.value),
                  })
                }
                className="w-full accent-emerald-700"
              />
            </div>
          </div>

          {/* Why Enterprise Buyers Acquire This Product (Clean Hairline Divided Columns, No Nested Cards) */}
          <div className="pt-5 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 mb-3">
              Почему крупная компания (Herbalife / Федеральная сеть) выкупает такой SaaS:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:divide-x sm:divide-slate-200 text-xs">
              <div className="sm:pr-3">
                <div className="font-semibold text-slate-900">
                  01. Удержание новичков
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  80% новых партнёров уходят в первые 60 дней из-за хаоса. Готовый чек-лист на 14 дней удерживает на +38% больше партнёров.
                </p>
              </div>
              <div className="sm:px-3">
                <div className="font-semibold text-slate-900">
                  02. Нулевой CAC через ветки
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  Лидер ветки (Супервайзор) сам переводит своих новых консультантов в систему ради прозрачного контроля их PV.
                </p>
              </div>
              <div className="sm:pl-3">
                <div className="font-semibold text-slate-900">
                  03. Отраслевое ядро PV
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  В отличие от универсального Bitrix24, здесь зашиты отраслевые метрики: Очки Объёма (PV), Марафоны и дубликация.
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-600">
              Индекс готовности к M&A Due Diligence:{' '}
              <span className="tabular-nums font-bold text-emerald-700">
                {metrics.readinessScore}/100
              </span>
            </div>

            <button
              type="button"
              onClick={() => setPitchGenerated(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Сформировать инвестиционный меморандум (B2B КП)
            </button>
          </div>

          {pitchGenerated && (
            <div
              role="region"
              aria-label="Сформированный инвестиционный тизер"
              className="pt-4 border-t border-slate-200 text-xs space-y-1.5"
            >
              <div className="font-bold text-slate-900">
                Инвестиционный тизер: {activePreset.brandName} (White-Label Enterprise)
              </div>
              <p className="text-slate-700 leading-relaxed">
                Целевой покупатель: <strong>{activePreset.corporateBuyerExample}</strong>.
                Текущая база: <strong className="tabular-nums">{valuationInput.activePartnersCount}</strong> независимых партнёров и{' '}
                <strong className="tabular-nums">{valuationInput.corporateEnterpriseSeats}</strong> корпоративных лицензий.
                Годовая выручка (ARR): <strong className="tabular-nums">{metrics.arrRub.toLocaleString('ru-RU')} ₽</strong> при Net Dollar Retention{' '}
                <strong className="tabular-nums">{metrics.netDollarRetentionPercent}%</strong>.
                Оценка актива при продаже стратегическому инвестору ({metrics.revenueMultiple}x ARR):{' '}
                <strong className="tabular-nums text-emerald-800">
                  {metrics.enterpriseValuationRub.toLocaleString('ru-RU')} ₽ (${metrics.enterpriseValuationUsd.toLocaleString('en-US')})
                </strong>.
              </p>
            </div>
          )}
        </section>

        {/* Right 5 Cols: White-Label Multi-Tenant Configurator & Tier Matrix */}
        <section
          aria-label="Настройка White-Label и тарифная сетка"
          className="lg:col-span-5 p-6 bg-white border border-slate-200 rounded-lg space-y-5"
        >
          <div className="pb-3 border-b border-slate-200">
            <h2 className="text-base font-bold text-slate-900">
              Конфигуратор White-Label для продажи крупным сетям
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Переключайте отраслевой пресет, чтобы увидеть, как ядро задач и CRM адаптируется под конкретного корпоративного заказчика:
            </p>
          </div>

          <div className="divide-y divide-slate-200">
            {presets.map((preset) => {
              const isSelected = preset.id === activePreset.id;
              return (
                <div key={preset.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold text-slate-900">
                      {preset.brandName}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {preset.industryLabel}
                    </div>
                    <div className="text-xs text-slate-600 mt-0.5">
                      Покупатель: {preset.corporateBuyerExample}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-slate-900 text-white'
                        : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                    }`}
                  >
                    {isSelected ? 'Активен' : 'Выбрать'}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Pricing Architecture Table */}
          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-xs font-bold text-slate-900 mb-2.5">
              Тарифная архитектура (гибрид B2C партнёров + B2B корпорации)
            </h3>
            <div className="divide-y divide-slate-200 text-xs">
              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    Для начинающих партнёров (Старт)
                  </div>
                  <div className="text-slate-500">
                    Плейбук 14 дней · До 50 клиентов в CRM · Чек-листы марафона
                  </div>
                </div>
                <div className="tabular-nums font-bold text-slate-900 whitespace-nowrap ml-3">
                  1 990 ₽ / мес
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    Для Супервайзоров и Клубов ЗОЖ
                  </div>
                  <div className="text-slate-500">
                    Контроль ветки до 25 партнёров · Авто-раздача задач · Аналитика PV
                  </div>
                </div>
                <div className="tabular-nums font-bold text-emerald-700 whitespace-nowrap ml-3">
                  4 900 ₽ / мес
                </div>
              </div>

              <div className="py-2.5 flex items-center justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    Корпоративный White-Label (Enterprise)
                  </div>
                  <div className="text-slate-500">
                    Собственный домен · SSO интеграция с ERP · Выделенный контур
                  </div>
                </div>
                <div className="tabular-nums font-bold text-slate-900 whitespace-nowrap ml-3">
                  от 450 000 ₽ / мес
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
