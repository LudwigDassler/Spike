import React, { useState } from 'react';
import {
  X,
  CreditCard,
  FileText,
  Printer,
  CheckCircle2,
  Loader2,
  Building2,
  ShieldCheck,
  Globe,
  Landmark,
  Wallet,
} from 'lucide-react';
import {
  BillingCycle,
  BillingInvoiceRecord,
  BillingPaymentMethod,
  CompanyBillingDetails,
  CurrencyCode,
  PaymentGatewayRegion,
  SubscriptionPlanTier,
} from '../types/database';
import {
  calculateSubscriptionPricing,
  generateInvoiceNumber,
} from '../utils/enterpriseLogic';
import { useLocale } from '../i18n/LocaleContext';

interface SubscriptionCheckoutModalProps {
  isOpen: boolean;
  initialPlan: SubscriptionPlanTier;
  paymentRegion: PaymentGatewayRegion;
  companyName: string;
  billingDetails?: CompanyBillingDetails | null;
  onClose: () => void;
  onConfirmSubscription: (params: {
    plan: SubscriptionPlanTier;
    billingCycle: BillingCycle;
    paymentMethod: BillingPaymentMethod;
    amount: number;
    currency: CurrencyCode;
    region: PaymentGatewayRegion;
    payerDetails?: CompanyBillingDetails;
    invoiceNumber: string;
  }) => Promise<void>;
}

export const SubscriptionCheckoutModal: React.FC<SubscriptionCheckoutModalProps> = ({
  isOpen,
  initialPlan,
  paymentRegion,
  companyName,
  billingDetails,
  onClose,
  onConfirmSubscription,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  const [plan, setPlan] = useState<SubscriptionPlanTier>(
    initialPlan === 'Trial' ? 'Business' : initialPlan
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [selectedRegion, setSelectedRegion] = useState<PaymentGatewayRegion>(
    paymentRegion || 'GLOBAL'
  );
  const [globalCurrency, setGlobalCurrency] = useState<CurrencyCode>('USD');
  const [paymentMethod, setPaymentMethod] = useState<BillingPaymentMethod>(
    (paymentRegion || 'GLOBAL') === 'GLOBAL' ? 'stripe_card' : 'card_sbp'
  );

  // International Wire Transfer / B2B Requisites state
  const [payerCompany, setPayerCompany] = useState(billingDetails?.legal_name || companyName);
  const [payerTaxId, setPayerTaxId] = useState(billingDetails?.tax_id || '');
  const [payerAddress, setPayerAddress] = useState(
    billingDetails?.legal_address || billingDetails?.country || ''
  );
  const [payerIbanSwift, setPayerIbanSwift] = useState(billingDetails?.iban_swift || '');
  const [cryptoNetwork, setCryptoNetwork] = useState<'USDT_TRC20' | 'USDC_ERC20'>('USDT_TRC20');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setPlan(initialPlan === 'Trial' ? 'Business' : initialPlan);
      const nextReg = paymentRegion || 'GLOBAL';
      setSelectedRegion(nextReg);
      setPaymentMethod(nextReg === 'GLOBAL' ? 'stripe_card' : 'card_sbp');
      setPayerCompany(billingDetails?.legal_name || companyName);
      setPayerTaxId(billingDetails?.tax_id || '');
      setPayerAddress(billingDetails?.legal_address || billingDetails?.country || '');
      setPayerIbanSwift(billingDetails?.iban_swift || '');
    }
  }, [isOpen, initialPlan, paymentRegion, billingDetails, companyName]);

  if (!isOpen) return null;

  const activeCurrency: CurrencyCode = selectedRegion === 'GLOBAL' ? globalCurrency : 'RUB';
  const pricing = calculateSubscriptionPricing(plan, billingCycle, selectedRegion, activeCurrency);

  const formatCheckoutPrice = (amount: number, curr: CurrencyCode) => {
    if (curr === 'USD') return `$${Math.round(amount).toLocaleString('en-US')}`;
    if (curr === 'EUR') return `€${Math.round(amount).toLocaleString('en-US')}`;
    return `${Math.round(amount).toLocaleString('ru-RU')} ₽`;
  };

  const handleRegionChange = (nextReg: PaymentGatewayRegion) => {
    setSelectedRegion(nextReg);
    if (nextReg === 'GLOBAL') {
      setPaymentMethod('stripe_card');
    } else {
      setPaymentMethod('card_sbp');
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      const updatedPayerDetails: CompanyBillingDetails = {
        ...(billingDetails || {}),
        region: selectedRegion,
        legal_name: payerCompany.trim() || companyName,
        tax_id: payerTaxId.trim() || undefined,
        legal_address: payerAddress.trim() || undefined,
        iban_swift: payerIbanSwift.trim() || undefined,
        wallet_network: paymentMethod === 'crypto_usdt' ? cryptoNetwork : undefined,
      };
      await onConfirmSubscription({
        plan,
        billingCycle,
        paymentMethod,
        amount: pricing.totalAmount,
        currency: activeCurrency,
        region: selectedRegion,
        payerDetails: updatedPayerDetails,
        invoiceNumber,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4 font-sans overflow-y-auto no-scrollbar"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[calc(100vw-24px)] max-w-2xl rounded-2xl border border-white/10 bg-[#111114] shadow-2xl overflow-hidden my-auto">
        <div className="px-5 sm:px-6 py-4 border-b border-white/[0.07] flex items-center justify-between bg-[#141418]">
          <div className="flex items-center gap-2.5 min-w-0">
            <CreditCard className="w-4 h-4 text-zinc-200 shrink-0" />
            <h3 className="text-sm font-semibold text-white tracking-tight truncate">
              {isEn
                ? 'Enterprise Subscription & Commercial Invoice Checkout'
                : 'Оформление корпоративной подписки и международного счета'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form
          onSubmit={handleConfirm}
          className="p-5 sm:p-6 space-y-5 max-h-[82vh] overflow-y-auto no-scrollbar"
        >
          {/* Payer Region Switcher inside the Checkout Modal */}
          <div className="rounded-xl border border-white/[0.07] bg-[#151519] p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-white">
                {isEn
                  ? 'Payer Jurisdiction & Settlement Gateway'
                  : 'Регион плательщика и шлюз расчетов'}
              </div>
              <div className="text-[11px] text-zinc-400">
                {isEn
                  ? 'Select your jurisdiction to configure available payment rails'
                  : 'Выберите юрисдикцию для настройки доступных платежных инструментов'}
              </div>
            </div>
            <div className="inline-flex items-center rounded-lg border border-white/10 bg-[#0C0C0E] p-0.5">
              <button
                type="button"
                onClick={() => handleRegionChange('GLOBAL')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedRegion === 'GLOBAL'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>International / Global (USD · EUR)</span>
              </button>
              <button
                type="button"
                onClick={() => handleRegionChange('RU')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  selectedRegion === 'RU'
                    ? 'bg-white text-black font-semibold'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{isEn ? 'RU & CIS (RUB)' : 'Россия и СНГ (RUB)'}</span>
              </button>
            </div>
          </div>

          {/* Plan Selector */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-zinc-300">
                {isEn
                  ? `Subscription Plan for "${companyName}"`
                  : `Тарифный план организации «${companyName}»`}
              </label>
              {selectedRegion === 'GLOBAL' && (
                <div className="inline-flex items-center rounded-md border border-white/10 bg-[#151519] p-0.5">
                  {(['USD', 'EUR'] as CurrencyCode[]).map((curr) => (
                    <button
                      key={curr}
                      type="button"
                      onClick={() => setGlobalCurrency(curr)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                        globalCurrency === curr
                          ? 'bg-white text-black'
                          : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {curr}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['Business', 'Enterprise'] as SubscriptionPlanTier[]).map((tier) => {
                const isSelected = plan === tier;
                const tierPrice = calculateSubscriptionPricing(
                  tier,
                  billingCycle,
                  selectedRegion,
                  activeCurrency
                );
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setPlan(tier)}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-white/80 bg-white/[0.04] shadow-sm'
                        : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-white">{tier}</span>
                      <span className="text-xs font-bold text-white tabular-nums">
                        {formatCheckoutPrice(tierPrice.monthlyPrice, activeCurrency)}{' '}
                        {isEn ? '/ mo' : '/ мес.'}
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-400 mt-1">
                      {tier === 'Business'
                        ? isEn
                          ? 'Up to 50 members · Full CRM, Kanban & Telegram Sync'
                          : 'До 50 сотрудников · Полный CRM, Канбан и Telegram-контур'
                        : isEn
                        ? 'Unlimited members · Dedicated SLA, RBAC & Security Audit'
                        : 'Безлимит сотрудников · Выделенный SLA, RBAC и аудит безопасности'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              {isEn ? 'Billing Cycle' : 'Расчетный период подписки'}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  billingCycle === 'monthly'
                    ? 'border-white/80 bg-white/[0.04]'
                    : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                }`}
              >
                <div className="text-xs font-semibold text-white">
                  {isEn ? 'Monthly' : 'Ежемесячно'}
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {isEn ? 'Flexible month-to-month billing' : 'Гибкий помесячный биллинг'}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  billingCycle === 'yearly'
                    ? 'border-white/80 bg-white/[0.04]'
                    : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">
                    {isEn ? 'Annual Contract (Save 20%)' : 'На 1 год (-20% выгода)'}
                  </span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-black tabular-nums">
                    -20%
                  </span>
                </div>
                <div className="text-[11px] text-zinc-400 mt-0.5">
                  {isEn
                    ? 'Annual enterprise commitment with locked pricing'
                    : 'Годовой корпоративный контракт с фиксацией цены'}
                </div>
              </button>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-medium text-zinc-300 mb-2">
              {isEn
                ? `Payment Method (${
                    selectedRegion === 'GLOBAL'
                      ? `International · ${activeCurrency}`
                      : 'RU & CIS · RUB'
                  })`
                : `Способ оплаты (${
                    selectedRegion === 'GLOBAL'
                      ? `International · ${activeCurrency}`
                      : 'Россия и СНГ · RUB'
                  })`}
            </label>

            {selectedRegion === 'GLOBAL' ? (
              <div className="space-y-2.5">
                {/* 1. Global Corporate Card / Apple Pay (Stripe / Paddle) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('stripe_card')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    paymentMethod === 'stripe_card'
                      ? 'border-white/80 bg-white/[0.04]'
                      : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-zinc-200 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Global Corporate Card / Apple Pay (Stripe / Paddle)
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {isEn
                          ? `Instant settlement via Visa, Mastercard, or Amex in ${activeCurrency}`
                          : `Мгновенная оплата картами Visa, Mastercard, Amex в ${activeCurrency} с автопродлением`}
                      </div>
                    </div>
                  </div>
                  {paymentMethod === 'stripe_card' && (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                </button>

                {/* 2. International Wire Transfer (SWIFT / SEPA / ACH Invoice) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('swift_wire')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    paymentMethod === 'swift_wire'
                      ? 'border-white/80 bg-white/[0.04]'
                      : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Landmark className="w-4 h-4 text-zinc-200 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        International Wire Transfer (SWIFT / SEPA / ACH Invoice)
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {isEn
                          ? 'Generate an official Commercial Invoice for EU, US, UK, and MENA entities'
                          : 'Генерация международного Commercial Invoice для юрлиц ЕС, США, ОАЭ и MENA'}
                      </div>
                    </div>
                  </div>
                  {paymentMethod === 'swift_wire' && (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                </button>

                {/* 3. Corporate Digital Assets (USDT / USDC — ERC-20 / TRC-20) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('crypto_usdt')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    paymentMethod === 'crypto_usdt'
                      ? 'border-white/80 bg-white/[0.04]'
                      : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Wallet className="w-4 h-4 text-zinc-200 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        Corporate Digital Assets (USDT / USDC — ERC-20 / TRC-20)
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {isEn
                          ? 'Stablecoin treasury settlement for distributed international teams'
                          : 'Оплата в стейблкоинах для международных распределенных команд и холдингов'}
                      </div>
                    </div>
                  </div>
                  {paymentMethod === 'crypto_usdt' && (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* 1. РФ / СНГ: Банковская карта / СБП (ЮKassa / CloudPayments) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card_sbp')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    paymentMethod === 'card_sbp'
                      ? 'border-white/80 bg-white/[0.04]'
                      : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CreditCard className="w-4 h-4 text-zinc-200 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {isEn
                          ? 'Corporate Card / SBP (YooKassa / CloudPayments)'
                          : 'Банковская карта / СБП (ЮKassa / CloudPayments)'}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {isEn
                          ? 'Instant settlement in RUB with automated receipt'
                          : 'Мгновенное проведение платежа в рублях (RUB) и электронный чек'}
                      </div>
                    </div>
                  </div>
                  {paymentMethod === 'card_sbp' && (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                </button>

                {/* 2. РФ / СНГ: Безналичный счет по реквизитам юрлица (ИНН / КПП + ЭДО Диадок) */}
                <button
                  type="button"
                  onClick={() => setPaymentMethod('b2b_invoice')}
                  className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                    paymentMethod === 'b2b_invoice'
                      ? 'border-white/80 bg-white/[0.04]'
                      : 'border-white/[0.07] bg-[#141418] hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-zinc-200 shrink-0" />
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {isEn
                          ? 'B2B Wire Invoice (INN / KPP + Diadoc EDO)'
                          : 'Безналичный счет по реквизитам юрлица (ИНН / КПП + ЭДО Диадок)'}
                      </div>
                      <div className="text-[11px] text-zinc-400">
                        {isEn
                          ? 'Official corporate wire invoice and closing accounting acts'
                          : 'Формирование официального счета на оплату и закрывающих актов УПД'}
                      </div>
                    </div>
                  </div>
                  {paymentMethod === 'b2b_invoice' && (
                    <CheckCircle2 className="w-4 h-4 text-white shrink-0" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Method-Specific Details Form */}
          {(paymentMethod === 'swift_wire' || paymentMethod === 'b2b_invoice') && (
            <div className="rounded-xl border border-white/[0.07] bg-[#15151A] p-4 space-y-3">
              <div className="text-xs font-semibold text-white">
                {selectedRegion === 'GLOBAL'
                  ? isEn
                    ? 'Payer Requisites for Commercial Invoice (SWIFT / SEPA)'
                    : 'Реквизиты плательщика для Commercial Invoice (SWIFT / SEPA)'
                  : isEn
                  ? 'Legal Entity Requisites for B2B Invoice (RU / CIS)'
                  : 'Реквизиты юридического лица для выставления счета (РФ / СНГ)'}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {selectedRegion === 'GLOBAL' || isEn
                      ? 'Company Legal Name'
                      : 'Наименование юрлица'}
                  </label>
                  <input
                    type="text"
                    value={payerCompany}
                    onChange={(e) => setPayerCompany(e.target.value)}
                    placeholder={companyName}
                    className="w-full rounded-lg border border-white/10 bg-[#101014] px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {selectedRegion === 'GLOBAL' || isEn
                      ? 'VAT / Tax ID / EIN'
                      : 'ИНН / КПП'}
                  </label>
                  <input
                    type="text"
                    value={payerTaxId}
                    onChange={(e) => setPayerTaxId(e.target.value)}
                    placeholder={
                      selectedRegion === 'GLOBAL'
                        ? 'EU372019482 / EIN 94-31209'
                        : '7701234567 / 770101001'
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#101014] px-3 py-1.5 text-xs text-white tabular-nums focus:border-white/30 focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-zinc-400 mb-1">
                    {selectedRegion === 'GLOBAL' || isEn
                      ? 'Billing Address & Country'
                      : 'Юридический адрес'}
                  </label>
                  <input
                    type="text"
                    value={payerAddress}
                    onChange={(e) => setPayerAddress(e.target.value)}
                    placeholder={
                      selectedRegion === 'GLOBAL'
                        ? 'Delaware, US / Limassol, CY / Dubai, UAE'
                        : 'г. Москва, Пресненская наб., д. 12'
                    }
                    className="w-full rounded-lg border border-white/10 bg-[#101014] px-3 py-1.5 text-xs text-white focus:border-white/30 focus:outline-none"
                  />
                </div>
                {selectedRegion === 'GLOBAL' && (
                  <div>
                    <label className="block text-[11px] text-zinc-400 mb-1">
                      IBAN / SWIFT BIC (Optional)
                    </label>
                    <input
                      type="text"
                      value={payerIbanSwift}
                      onChange={(e) => setPayerIbanSwift(e.target.value)}
                      placeholder="DE89 3704 0044 0532 0130 00"
                      className="w-full rounded-lg border border-white/10 bg-[#101014] px-3 py-1.5 text-xs text-white tabular-nums focus:border-white/30 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {paymentMethod === 'crypto_usdt' && (
            <div className="rounded-xl border border-white/[0.07] bg-[#15151A] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-white">
                  {isEn ? 'Stablecoin Settlement Network' : 'Расчетная сеть стейблкоина'}
                </span>
                <div className="inline-flex rounded-lg border border-white/10 bg-[#101014] p-0.5">
                  <button
                    type="button"
                    onClick={() => setCryptoNetwork('USDT_TRC20')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      cryptoNetwork === 'USDT_TRC20'
                        ? 'bg-white text-black font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    USDT (TRC-20)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCryptoNetwork('USDC_ERC20')}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      cryptoNetwork === 'USDC_ERC20'
                        ? 'bg-white text-black font-semibold'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    USDC (ERC-20)
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                {isEn
                  ? 'A corporate payment order and verified TedCloud Treasury wallet address will be included in the generated Commercial Invoice.'
                  : 'Корпоративный платежный ордер и верифицированный адрес казначейства TedCloud Treasury будут включены в формируемый Commercial Invoice.'}
              </p>
            </div>
          )}

          {/* Summary Box */}
          <div className="rounded-xl border border-white/10 bg-[#16161C] p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-zinc-400">
                {isEn ? pricing.periodLabelEn : pricing.periodLabelRu}
              </div>
              <div className="text-sm font-semibold text-white mt-0.5">
                {isEn ? `Total Due (${plan}):` : `Итого к оплате (${plan}):`}
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-white tabular-nums">
                {formatCheckoutPrice(pricing.totalAmount, activeCurrency)}
              </div>
              {billingCycle === 'yearly' && (
                <div className="text-[11px] text-zinc-400 tabular-nums">
                  ({formatCheckoutPrice(pricing.monthlyPrice, activeCurrency)}{' '}
                  {isEn ? '/ mo' : '/ мес.'})
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-white/10 bg-zinc-900 text-xs font-medium text-zinc-300 hover:text-white"
            >
              {isEn ? 'Cancel' : 'Отмена'}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-black hover:bg-zinc-200 disabled:opacity-50 text-xs font-semibold transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>
                {paymentMethod === 'card_sbp' || paymentMethod === 'stripe_card'
                  ? isEn
                    ? 'Pay & Activate Plan'
                    : 'Оплатить и активировать тариф'
                  : isEn
                  ? 'Generate Commercial Invoice'
                  : 'Сформировать коммерческий счет'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

interface PrintableInvoiceModalProps {
  invoice: BillingInvoiceRecord | null;
  companyName: string;
  paymentRegion: PaymentGatewayRegion;
  fallbackBillingDetails?: CompanyBillingDetails | null;
  onClose: () => void;
  onMarkPaid?: (invoiceId: string) => Promise<void>;
}

export const PrintableInvoiceModal: React.FC<PrintableInvoiceModalProps> = ({
  invoice,
  companyName,
  paymentRegion,
  fallbackBillingDetails,
  onClose,
  onMarkPaid,
}) => {
  const { language } = useLocale();
  const isEn = language === 'en';
  if (!invoice) return null;

  const details: CompanyBillingDetails = {
    ...(fallbackBillingDetails || {}),
    ...((invoice.payer_details as CompanyBillingDetails) || {}),
  };

  const isGlobal =
    (details.region || paymentRegion) === 'GLOBAL' ||
    invoice.currency === 'USD' ||
    invoice.currency === 'EUR' ||
    invoice.payment_method === 'stripe_card' ||
    invoice.payment_method === 'swift_wire' ||
    invoice.payment_method === 'crypto_usdt';

  const createdDate = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString(isEn ? 'en-US' : 'ru-RU')
    : new Date().toLocaleDateString(isEn ? 'en-US' : 'ru-RU');

  const payerLegalName = details.legal_name || companyName;
  const payerTaxId = details.tax_id || (isGlobal ? 'EU37209184' : '7701234567');
  const payerRegNum = details.reg_number || (isGlobal ? '' : '770101001');
  const payerAddress =
    details.legal_address ||
    details.country ||
    (isGlobal
      ? '251 Little Falls Drive, Wilmington, DE 19808, United States'
      : 'РФ, г. Москва, Пресненская наб., д. 12');

  const serviceDescriptionRu = `Лицензия на использование корпоративной SaaS-платформы TedCloud Enterprise (Тариф «${
    invoice.plan
  }», период: ${invoice.billing_cycle === 'yearly' ? '12 месяцев' : '1 месяц'})`;

  const serviceDescriptionEn = `TedCloud Enterprise Workspace SaaS Subscription (Plan: ${
    invoice.plan
  }, Billing Cycle: ${invoice.billing_cycle === 'yearly' ? 'Annual (12 Months)' : 'Monthly'})`;

  const methodLabelEn =
    invoice.payment_method === 'stripe_card'
      ? 'Global Corporate Card (Stripe / Apple Pay)'
      : invoice.payment_method === 'crypto_usdt'
      ? `Corporate Digital Assets (${details.wallet_network || 'USDT TRC-20 / USDC ERC-20'})`
      : 'International Wire Transfer (SWIFT / SEPA / ACH)';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-3 sm:p-4 font-sans overflow-y-auto no-scrollbar"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-[calc(100vw-24px)] max-w-3xl rounded-2xl border border-white/10 bg-[#121216] shadow-2xl overflow-hidden my-8">
        {/* Top Action Bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/[0.07] bg-[#16161C] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-zinc-200" />
            <span className="text-xs font-semibold text-white tabular-nums">
              {isEn ? 'Official Billing Document' : 'Официальный платежный документ'} ·{' '}
              {invoice.invoice_number}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                invoice.status === 'Paid'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {invoice.status === 'Paid'
                ? isEn
                  ? 'Paid'
                  : 'Оплачен (Paid)'
                : isEn
                ? 'Issued'
                : 'Выставлен (Issued)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status !== 'Paid' && onMarkPaid && (
              <button
                type="button"
                onClick={() => void onMarkPaid(invoice.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-white transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isEn ? 'Mark as Paid' : 'Отметить оплаченным'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-zinc-200 text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>{isEn ? 'Print / Save PDF' : 'Печать / Сохранить PDF'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-5 sm:p-8 bg-white text-black space-y-6 text-xs overflow-x-auto">
          {!isGlobal ? (
            <>
              {/* РФ Счет на оплату */}
              <div className="border border-black text-[11px]">
                <div className="grid grid-cols-12 border-b border-black">
                  <div className="col-span-7 p-2 border-r border-black">
                    <div className="font-medium">АО «Т-БАНК» г. Москва</div>
                    <div className="text-[10px] text-zinc-600 mt-1">Банк получателя</div>
                  </div>
                  <div className="col-span-2 p-2 border-r border-black">
                    <div>БИК</div>
                    <div className="mt-1">Сч. №</div>
                  </div>
                  <div className="col-span-3 p-2 tabular-nums">
                    <div>044525974</div>
                    <div className="mt-1">30101810145250000974</div>
                  </div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-7 p-2 border-r border-black">
                    <div className="tabular-nums">
                      <strong>ИНН</strong> 9705114405 &nbsp;&nbsp; <strong>КПП</strong> 770501001
                    </div>
                    <div className="font-semibold mt-1">ООО «ТЕДКЛАУД ЭНТЕРПРАЙЗ СИСТЕМС»</div>
                    <div className="text-[10px] text-zinc-600 mt-1">Получатель</div>
                  </div>
                  <div className="col-span-2 p-2 border-r border-black">
                    <div>Сч. №</div>
                  </div>
                  <div className="col-span-3 p-2 tabular-nums">
                    <div>40702810910000592814</div>
                  </div>
                </div>
              </div>

              <div className="border-b-2 border-black pb-3">
                <h1 className="text-lg font-bold tracking-tight tabular-nums">
                  СЧЕТ НА ОПЛАТУ № {invoice.invoice_number} от {createdDate} г.
                </h1>
              </div>

              <div className="space-y-2 text-xs">
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-3 text-zinc-600">Поставщик:</span>
                  <strong className="col-span-9">
                    ООО «ТЕДКЛАУД ЭНТЕРПРАЙЗ СИСТЕМС», ИНН 9705114405, КПП 770501001, г. Москва
                  </strong>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-3 text-zinc-600">Покупатель (Плательщик):</span>
                  <strong className="col-span-9">
                    {payerLegalName}, ИНН {payerTaxId}
                    {payerRegNum ? `, КПП ${payerRegNum}` : ''}, Адрес: {payerAddress}
                  </strong>
                </div>
                <div className="grid grid-cols-12 gap-2">
                  <span className="col-span-3 text-zinc-600">Основание:</span>
                  <span className="col-span-9 font-medium">
                    Корпоративная оферта TedCloud Enterprise (Тариф {invoice.plan})
                  </span>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b border-black text-left">
                    <th className="border-r border-black p-2 w-10 text-center">№</th>
                    <th className="border-r border-black p-2">Наименование работ, услуг (ЛИЦЕНЗИЯ)</th>
                    <th className="border-r border-black p-2 w-16 text-center">Кол-во</th>
                    <th className="border-r border-black p-2 w-16 text-center">Ед.</th>
                    <th className="border-r border-black p-2 w-28 text-right">Цена</th>
                    <th className="p-2 w-28 text-right">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-black p-2 text-center">1</td>
                    <td className="border-r border-black p-2 font-medium">
                      {serviceDescriptionRu}
                    </td>
                    <td className="border-r border-black p-2 text-center">1</td>
                    <td className="border-r border-black p-2 text-center">лиц.</td>
                    <td className="border-r border-black p-2 text-right tabular-nums">
                      {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                    </td>
                    <td className="p-2 text-right tabular-nums font-semibold">
                      {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex flex-col items-end space-y-1 text-xs pt-2">
                <div className="flex justify-between w-64">
                  <span className="font-semibold">Итого без НДС:</span>
                  <span className="tabular-nums font-bold">
                    {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                  </span>
                </div>
                <div className="flex justify-between w-64">
                  <span>НДС (Не облагается, Реестр ПО):</span>
                  <span className="tabular-nums">0 {invoice.currency}</span>
                </div>
                <div className="flex justify-between w-64 text-sm border-t border-black pt-1">
                  <span className="font-bold">Всего к оплате:</span>
                  <span className="tabular-nums font-bold">
                    {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-zinc-300 text-xs">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-semibold">Генеральный директор</span>
                  <span className="text-zinc-500">/ Подпись ЭДО Диадок /</span>
                </div>
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-semibold">Главный бухгалтер</span>
                  <span className="text-zinc-500">/ Подпись ЭДО Диадок /</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* GLOBAL COMMERCIAL INVOICE (SWIFT / SEPA / ACH / USDT) */}
              <div className="flex items-start justify-between border-b-2 border-black pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight tabular-nums">
                    COMMERCIAL INVOICE #{invoice.invoice_number}
                  </h1>
                  <p className="text-zinc-600 mt-1 tabular-nums">Issue Date: {createdDate}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">TEDCLOUD ENTERPRISE INC.</div>
                  <div className="text-zinc-600">Global Cloud Billing & SaaS Licensing</div>
                  <div className="text-[11px] text-zinc-500">
                    Delaware, United States · EU VAT Registered
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-2">
                <div>
                  <div className="text-[10px] font-bold uppercase text-zinc-500">Billed To</div>
                  <div className="font-bold text-sm mt-1">{payerLegalName}</div>
                  <div className="tabular-nums">VAT / Tax ID / EIN: {payerTaxId}</div>
                  <div>Billing Address: {payerAddress}</div>
                  {details.iban_swift && (
                    <div className="tabular-nums">Customer IBAN / SWIFT: {details.iban_swift}</div>
                  )}
                </div>
                <div className="sm:text-right">
                  <div className="text-[10px] font-bold uppercase text-zinc-500">
                    Settlement & Coordinates
                  </div>
                  <div className="font-bold text-sm mt-1 uppercase">{invoice.status}</div>
                  <div>Gateway: {methodLabelEn}</div>
                  <div className="text-[11px] text-zinc-600 tabular-nums mt-1">
                    SWIFT BIC: TEDCUS33XXX · IBAN: IE29TEDC99036510293847
                  </div>
                </div>
              </div>

              <table className="w-full border-collapse border border-black text-xs">
                <thead>
                  <tr className="bg-zinc-100 border-b border-black text-left">
                    <th className="border-r border-black p-2.5">Description</th>
                    <th className="border-r border-black p-2.5 w-24 text-center">Cycle</th>
                    <th className="p-2.5 w-36 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border-r border-black p-2.5 font-medium">
                      {serviceDescriptionEn}
                    </td>
                    <td className="border-r border-black p-2.5 text-center uppercase">
                      {invoice.billing_cycle}
                    </td>
                    <td className="p-2.5 text-right tabular-nums font-bold">
                      {Math.round(invoice.amount).toLocaleString('en-US')} {invoice.currency}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end pt-3">
                <div className="w-64 flex justify-between border-t-2 border-black pt-2 text-sm font-bold">
                  <span>TOTAL DUE:</span>
                  <span className="tabular-nums">
                    {Math.round(invoice.amount).toLocaleString('en-US')} {invoice.currency}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
