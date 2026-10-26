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
} from 'lucide-react';
import {
  BillingCycle,
  BillingInvoiceRecord,
   BillingPaymentMethod,
  CompanyBillingDetails,
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
  const { formatMoney } = useLocale();
  const [plan, setPlan] = useState<SubscriptionPlanTier>(
    initialPlan === 'Trial' ? 'Business' : initialPlan
  );
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('yearly');
  const [paymentMethod, setPaymentMethod] = useState<BillingPaymentMethod>('b2b_invoice');
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setPlan(initialPlan === 'Trial' ? 'Business' : initialPlan);
    }
  }, [isOpen, initialPlan]);

  if (!isOpen) return null;

  const pricing = calculateSubscriptionPricing(plan, billingCycle);

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const invoiceNumber = generateInvoiceNumber();
      await onConfirmSubscription({
        plan,
        billingCycle,
        paymentMethod,
        amount: pricing.totalAmountRub,
        invoiceNumber,
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 font-sans"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-xl rounded-2xl border border-[#2A2A32] bg-[#111115] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#222228] flex items-center justify-between bg-[#141419]">
          <div className="flex items-center gap-2.5">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white tracking-tight">
              Оформление корпоративной подписки и B2B-счета
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#1E1E24]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleConfirm} className="p-6 space-y-5">
          {/* Plan Selector */}
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-2">
              Тарифный план организации «{companyName}»
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['Business', 'Enterprise'] as SubscriptionPlanTier[]).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setPlan(tier)}
                  className={`p-3.5 rounded-xl border text-left transition-colors ${
                    plan === tier
                      ? 'border-white bg-[#191920]'
                      : 'border-[#26262E] bg-[#141418] hover:border-[#3F3F46]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{tier}</span>
                    {plan === tier && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[11px] text-[#8E8E93] mt-1">
                    {tier === 'Business'
                      ? 'До 50 сотрудников · Полный CRM и Telegram-контур'
                      : 'Безлимит сотрудников · Выделенный SLA и ИИ-аудит'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Billing Cycle Toggle */}
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-2">
              Расчетный период подписки
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  billingCycle === 'monthly'
                    ? 'border-white bg-[#191920]'
                    : 'border-[#26262E] bg-[#141418] hover:border-[#3F3F46]'
                }`}
              >
                <div className="text-xs font-semibold text-white">Ежемесячно</div>
                <div className="text-[11px] text-[#8E8E93] mt-0.5">
                  Базовый помесячный биллинг
                </div>
              </button>

              <button
                type="button"
                onClick={() => setBillingCycle('yearly')}
                className={`p-3 rounded-xl border text-left transition-colors ${
                  billingCycle === 'yearly'
                    ? 'border-emerald-500/60 bg-emerald-950/20'
                    : 'border-[#26262E] bg-[#141418] hover:border-[#3F3F46]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">На 1 год (-20% выгода)</span>
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                    -20%
                  </span>
                </div>
                <div className="text-[11px] text-[#8E8E93] mt-0.5">
                  Годовой корпоративный контракт
                </div>
              </button>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-xs font-medium text-[#A1A1AA] mb-2">
              Способ оплаты ({paymentRegion === 'RU' ? 'РФ / СНГ' : 'Global'})
            </label>
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setPaymentMethod('card_sbp')}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  paymentMethod === 'card_sbp'
                    ? 'border-white bg-[#191920]'
                    : 'border-[#26262E] bg-[#141418] hover:border-[#3F3F46]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Корпоративная карта / СБП (Мгновенная активация)
                    </div>
                    <div className="text-[11px] text-[#8E8E93]">
                      Автоматическое проведение платежа и закрывающий чек
                    </div>
                  </div>
                </div>
                {paymentMethod === 'card_sbp' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('b2b_invoice')}
                className={`w-full p-3.5 rounded-xl border text-left flex items-center justify-between transition-colors ${
                  paymentMethod === 'b2b_invoice'
                    ? 'border-white bg-[#191920]'
                    : 'border-[#26262E] bg-[#141418] hover:border-[#3F3F46]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <FileText className="w-4 h-4 text-blue-400 shrink-0" />
                  <div>
                    <div className="text-xs font-semibold text-white">
                      Безналичный счет для юрлица (B2B Invoice)
                    </div>
                    <div className="text-[11px] text-[#8E8E93]">
                      Формирование официального счета на оплату по реквизитам ({billingDetails?.legal_name || companyName})
                    </div>
                  </div>
                </div>
                {paymentMethod === 'b2b_invoice' && (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Summary Box */}
          <div className="rounded-xl border border-[#24242C] bg-[#16161C] p-4 flex items-center justify-between">
            <div>
              <div className="text-xs text-[#8E8E93]">{pricing.periodLabelRu}</div>
              <div className="text-sm font-semibold text-white mt-0.5">
                Итого к оплате ({plan}):
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-emerald-400 font-mono">
                {formatMoney(pricing.totalAmountRub)}
              </div>
              {billingCycle === 'yearly' && (
                <div className="text-[11px] text-[#8E8E93]">
                  ({formatMoney(pricing.monthlyPriceRub)} / мес.)
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#2C2C34] bg-[#18181E] text-xs font-medium text-[#A1A1AA] hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-white text-black hover:bg-[#E4E4E7] disabled:opacity-50 text-xs font-semibold transition-colors"
            >
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>
                {paymentMethod === 'card_sbp'
                  ? 'Оплатить и активировать тариф'
                  : 'Сформировать B2B-счет'}
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
  if (!invoice) return null;

  const details: CompanyBillingDetails = {
    ...(fallbackBillingDetails || {}),
    ...((invoice.payer_details as CompanyBillingDetails) || {}),
  };

  const isGlobal = (details.region || paymentRegion) === 'GLOBAL';
  const createdDate = invoice.created_at
    ? new Date(invoice.created_at).toLocaleDateString('ru-RU')
    : new Date().toLocaleDateString('ru-RU');

  const payerLegalName = details.legal_name || companyName;
  const payerTaxId = details.tax_id || '7701234567';
  const payerRegNum = details.reg_number || '770101001';
  const payerAddress =
    details.legal_address || details.country || 'РФ, г. Москва, Пресненская наб., д. 12';

  const serviceDescriptionRu = `Лицензия на использование корпоративной SaaS-платформы TedCloud Enterprise (Тариф «${
    invoice.plan
  }», период: ${invoice.billing_cycle === 'yearly' ? '12 месяцев' : '1 месяц'})`;

  const serviceDescriptionEn = `TedCloud Enterprise Workspace SaaS Subscription (Plan: ${
    invoice.plan
  }, Billing Cycle: ${invoice.billing_cycle === 'yearly' ? 'Annual (12 Months)' : 'Monthly'})`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 font-sans overflow-y-auto"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-3xl rounded-2xl border border-[#2A2A32] bg-[#121216] shadow-2xl overflow-hidden my-8">
        {/* Top Action Bar */}
        <div className="px-6 py-4 border-b border-[#222228] bg-[#16161C] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-white">
              Официальный платежный документ · {invoice.invoice_number}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                invoice.status === 'Paid'
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {invoice.status === 'Paid' ? 'Оплачен (Paid)' : 'Выставлен (Issued)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {invoice.status !== 'Paid' && onMarkPaid && (
              <button
                type="button"
                onClick={() => void onMarkPaid(invoice.id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Отметить оплаченным</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white text-black hover:bg-[#E4E4E7] text-xs font-semibold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Печать / Сохранить PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8E8E93] hover:text-white hover:bg-[#22222A]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="p-8 bg-white text-black space-y-6 text-xs">
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
                  <div className="col-span-3 p-2 font-mono">
                    <div>044525974</div>
                    <div className="mt-1">30101810145250000974</div>
                  </div>
                </div>
                <div className="grid grid-cols-12">
                  <div className="col-span-7 p-2 border-r border-black">
                    <div>
                      <strong>ИНН</strong> 9705114405 &nbsp;&nbsp; <strong>КПП</strong> 770501001
                    </div>
                    <div className="font-semibold mt-1">ООО «ТЕДКЛАУД ЭНТЕРПРАЙЗ СИСТЕМС»</div>
                    <div className="text-[10px] text-zinc-600 mt-1">Получатель</div>
                  </div>
                  <div className="col-span-2 p-2 border-r border-black">
                    <div>Сч. №</div>
                  </div>
                  <div className="col-span-3 p-2 font-mono">
                    <div>40702810910000592814</div>
                  </div>
                </div>
              </div>

              <div className="border-b-2 border-black pb-3">
                <h1 className="text-lg font-bold tracking-tight">
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
                    <td className="border-r border-black p-2 text-right font-mono">
                      {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                    </td>
                    <td className="p-2 text-right font-mono font-semibold">
                      {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex flex-col items-end space-y-1 text-xs pt-2">
                <div className="flex justify-between w-64">
                  <span className="font-semibold">Итого без НДС:</span>
                  <span className="font-mono font-bold">
                    {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                  </span>
                </div>
                <div className="flex justify-between w-64">
                  <span>НДС (Не облагается, Реестр ПО):</span>
                  <span className="font-mono">0 {invoice.currency}</span>
                </div>
                <div className="flex justify-between w-64 text-sm border-t border-black pt-1">
                  <span className="font-bold">Всего к оплате:</span>
                  <span className="font-mono font-bold">
                    {Math.round(invoice.amount).toLocaleString('ru-RU')} {invoice.currency}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 pt-6 border-t border-zinc-300 text-xs">
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-semibold">Генеральный директор</span>
                  <span className="text-zinc-500">/ Подпись ЭДО TedCloud /</span>
                </div>
                <div className="flex items-center justify-between border-b border-black pb-2">
                  <span className="font-semibold">Главный бухгалтер</span>
                  <span className="text-zinc-500">/ Подпись ЭДО TedCloud /</span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* GLOBAL COMMERCIAL INVOICE */}
              <div className="flex items-start justify-between border-b-2 border-black pb-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    COMMERCIAL INVOICE #{invoice.invoice_number}
                  </h1>
                  <p className="text-zinc-600 mt-1">Issue Date: {createdDate}</p>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm">TEDCLOUD ENTERPRISE INC.</div>
                  <div className="text-zinc-600">Global Cloud Billing & SaaS Licensing</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 py-2">
                <div>
                  <div className="text-[10px] font-bold uppercase text-zinc-500">Billed To</div>
                  <div className="font-bold text-sm mt-1">{payerLegalName}</div>
                  <div>VAT / Tax ID: {payerTaxId}</div>
                  <div>Country / Address: {payerAddress}</div>
                  {details.billing_email && <div>Email: {details.billing_email}</div>}
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase text-zinc-500">
                    Payment Status
                  </div>
                  <div className="font-bold text-sm mt-1 uppercase">{invoice.status}</div>
                  <div>Method: {invoice.payment_method === 'card_sbp' ? 'Corporate Card' : 'B2B Wire Transfer'}</div>
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
                    <td className="p-2.5 text-right font-mono font-bold">
                      {Math.round(invoice.amount).toLocaleString('en-US')} {invoice.currency}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end pt-3">
                <div className="w-64 flex justify-between border-t-2 border-black pt-2 text-sm font-bold">
                  <span>TOTAL DUE:</span>
                  <span className="font-mono">
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
