import React, { useState } from 'react';
import { CrmLead, LeadStage, PartnerNode, WhiteLabelPreset } from '../types/saas';
import { UserPlus } from 'lucide-react';

interface CrmPipelineViewProps {
  leads: CrmLead[];
  partners: PartnerNode[];
  activePreset: WhiteLabelPreset;
  onAdvanceLeadStage: (leadId: string) => void;
  onConvertLeadToPartner: (lead: CrmLead) => void;
  onAddLead: (newLead: Omit<CrmLead, 'id' | 'lastActivity'>) => void;
}

const STAGE_META: Record<LeadStage, { label: string; stepIndex: number }> = {
  contact: { label: '1. Первичный контакт', stepIndex: 1 },
  consultation: { label: '2. Диагностика / Тест', stepIndex: 2 },
  marathon: { label: '3. Марафон 10 дней', stepIndex: 3 },
  repeat_client: { label: '4. Постоянный клиент', stepIndex: 4 },
  partner_ready: { label: '5. Кандидат в партнёры', stepIndex: 5 },
};

export const CrmPipelineView: React.FC<CrmPipelineViewProps> = ({
  leads,
  partners,
  activePreset,
  onAdvanceLeadStage,
  onConvertLeadToPartner,
  onAddLead,
}) => {
  const [selectedStage, setSelectedStage] = useState<LeadStage | 'all'>('all');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Москва');
  const [programName, setProgramName] = useState(activePreset.clientEventLabel);
  const [monthlyPv, setMonthlyPv] = useState('140');
  const [dealValueRub, setDealValueRub] = useState('16800');
  const [mentorName, setMentorName] = useState(partners[0]?.name || 'Алина Соколова');
  const [formError, setFormError] = useState('');

  const filteredLeads =
    selectedStage === 'all'
      ? leads
      : leads.filter((l) => l.stage === selectedStage);

  const totalPipelineRub = leads.reduce((sum, l) => sum + l.dealValueRub, 0);
  const totalPipelinePv = leads.reduce((sum, l) => sum + l.monthlyPv, 0);
  const convertedCount = leads.filter((l) => l.convertedToPartner).length;

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      setFormError('Укажите имя клиента и контактный телефон.');
      return;
    }
    onAddLead({
      name: name.trim(),
      phone: phone.trim(),
      city: city.trim() || 'Москва',
      stage: 'consultation',
      monthlyPv: Number(monthlyPv) || 120,
      dealValueRub: Number(dealValueRub) || 14500,
      programName: programName.trim() || activePreset.clientEventLabel,
      mentorName,
    });
    setName('');
    setPhone('');
    setFormError('');
    setIsAddFormOpen(false);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div>
          <div className="text-xs text-slate-500 mb-1">
            Клиентский конвейер · {activePreset.brandName} · Конверсия «Клиент → Партнёр»
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            CRM-воронка марафонов и рекрутинга партнёров
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setIsAddFormOpen(!isAddFormOpen)}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors self-start whitespace-nowrap shrink-0"
        >
          {isAddFormOpen ? 'Скрыть анкету клиента' : '+ Добавить клиента в воронку'}
        </button>
      </div>

      {/* Add Client Inline Drawer */}
      {isAddFormOpen && (
        <form
          onSubmit={handleCreateLead}
          className="p-5 bg-white border border-slate-200 rounded-lg space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <h2 className="text-sm font-bold text-slate-900">
              Регистрация нового клиента / участника марафона
            </h2>
            <span className="text-xs text-slate-500">
              Этап по умолчанию: 2. Диагностика / Тест
            </span>
          </div>

          {formError && (
            <div
              role="alert"
              className="p-2.5 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded"
            >
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label htmlFor="crm-lead-name" className="block text-xs font-semibold text-slate-700 mb-1">
                ФИО клиента *
              </label>
              <input
                id="crm-lead-name"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="Например: Марина Соловьёва"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="crm-lead-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                Телефон / Telegram *
              </label>
              <input
                id="crm-lead-phone"
                type="text"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (formError) setFormError('');
                }}
                placeholder="+7 (999) 000-00-00"
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="crm-lead-city" className="block text-xs font-semibold text-slate-700 mb-1">
                Город
              </label>
              <input
                id="crm-lead-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label htmlFor="crm-lead-program" className="block text-xs font-semibold text-slate-700 mb-1">
                Целевая программа / Продукт
              </label>
              <input
                id="crm-lead-program"
                type="text"
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="crm-lead-pv" className="block text-xs font-semibold text-slate-700 mb-1">
                Объём заказа (PV)
              </label>
              <input
                id="crm-lead-pv"
                type="number"
                value={monthlyPv}
                onChange={(e) => setMonthlyPv(e.target.value)}
                className="w-full px-3 py-1.5 text-xs tabular-nums bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label htmlFor="crm-lead-rub" className="block text-xs font-semibold text-slate-700 mb-1">
                Сумма чека (₽)
              </label>
              <input
                id="crm-lead-rub"
                type="number"
                value={dealValueRub}
                onChange={(e) => setDealValueRub(e.target.value)}
                className="w-full px-3 py-1.5 text-xs tabular-nums bg-slate-50 border border-slate-300 rounded-md"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <label htmlFor="crm-lead-mentor" className="text-xs font-semibold text-slate-700">
                Куратор:
              </label>
              <select
                id="crm-lead-mentor"
                value={mentorName}
                onChange={(e) => setMentorName(e.target.value)}
                className="px-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded"
              >
                {partners.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Сохранить клиента в CRM
            </button>
          </div>
        </form>
      )}

      {/* Funnel Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Объём клиентской базы в работе</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {totalPipelineRub.toLocaleString('ru-RU')} ₽
          </div>
          <div className="mt-1 text-xs text-slate-500 tabular-nums">
            {leads.length} активных карточек клиентов
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Ежемесячный клиентский объём</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">
            {totalPipelinePv.toLocaleString('ru-RU')} PV
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Формирует квалификационный объём наставников
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg">
          <div className="text-xs text-slate-500">Переведено из клиентов в партнёры</div>
          <div className="mt-1 text-2xl font-bold tabular-nums text-slate-900">
            {convertedCount} чел.
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Авто-запуск онбординга при конверсии
          </div>
        </div>
      </div>

      {/* Stage Filter Segmented Control */}
      <div
        role="group"
        aria-label="Фильтр по этапам CRM-воронки"
        className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-lg"
      >
        <button
          type="button"
          onClick={() => setSelectedStage('all')}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
            selectedStage === 'all'
              ? 'bg-white text-slate-900 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Все клиенты ({leads.length})
        </button>
        {(Object.keys(STAGE_META) as LeadStage[]).map((stageKey) => {
          const count = leads.filter((l) => l.stage === stageKey).length;
          return (
            <button
              key={stageKey}
              type="button"
              onClick={() => setSelectedStage(stageKey)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                selectedStage === stageKey
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {STAGE_META[stageKey].label} ({count})
            </button>
          );
        })}
      </div>

      {/* High-Density CRM Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
              <th className="py-3 px-4">Клиент и программа</th>
              <th className="py-3 px-4">Этап воронки</th>
              <th className="py-3 px-4">Наставник / Город</th>
              <th className="py-3 px-4 text-right">Личный заказ (PV)</th>
              <th className="py-3 px-4 text-right">Чек (₽)</th>
              <th className="py-3 px-4 text-right">Операции воронки</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {filteredLeads.map((lead) => {
              const stageInfo = STAGE_META[lead.stage];
              return (
                <tr key={lead.id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="font-semibold text-slate-900">{lead.name}</div>
                    <div className="text-slate-500 mt-0.5">
                      {lead.phone} · {lead.programName}
                    </div>
                    <div className="text-slate-500 mt-0.5">{lead.lastActivity}</div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-800">{stageInfo.label}</div>
                    <div className="text-slate-500 tabular-nums mt-0.5">
                      Шаг {stageInfo.stepIndex} из 5
                    </div>
                  </td>

                  <td className="py-3.5 px-4 whitespace-nowrap">
                    <div className="font-medium text-slate-900">{lead.mentorName}</div>
                    <div className="text-slate-500">{lead.city}</div>
                  </td>

                  <td className="py-3.5 px-4 text-right tabular-nums font-semibold text-emerald-700 whitespace-nowrap">
                    {lead.monthlyPv} PV
                  </td>

                  <td className="py-3.5 px-4 text-right tabular-nums font-medium text-slate-900 whitespace-nowrap">
                    {lead.dealValueRub.toLocaleString('ru-RU')} ₽
                  </td>

                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-2">
                      {lead.stage !== 'partner_ready' && (
                        <button
                          type="button"
                          onClick={() => onAdvanceLeadStage(lead.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors whitespace-nowrap shrink-0"
                        >
                          След. этап →
                        </button>
                      )}

                      {!lead.convertedToPartner ? (
                        <button
                          type="button"
                          onClick={() => onConvertLeadToPartner(lead)}
                          className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Перевести в партнёры</span>
                        </button>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-700">
                          ✓ В партнёрской сети
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
