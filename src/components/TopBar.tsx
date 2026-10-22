import React from 'react';

export type ActiveTab = 'tasks' | 'crm' | 'partners' | 'enterprise';

interface TopBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onOpenNewTaskModal: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onSelectTab,
  onOpenNewTaskModal,
}) => {
  const navItems: Array<{ id: ActiveTab; label: string }> = [
    { id: 'tasks', label: 'Задачи и проекты' },
    { id: 'crm', label: 'Воронка и CRM' },
    { id: 'partners', label: 'Партнёрская сеть' },
    { id: 'enterprise', label: 'B2B продажа и White-Label' },
  ];

  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-30">
      {/* Zone 1: Single text element wordmark */}
      <a
        href="#workspace"
        onClick={(e) => {
          e.preventDefault();
          onSelectTab('tasks');
        }}
        className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
      >
        ПартнёрФлоу
      </a>

      {/* Zone 2: 4 concise single-line navigation links */}
      <nav
        aria-label="Основная навигация"
        className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-600"
      >
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectTab(item.id)}
              className={`py-1 transition-colors whitespace-nowrap shrink-0 border-b-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                isActive
                  ? 'border-emerald-700 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center shrink-0">
        <button
          type="button"
          onClick={onOpenNewTaskModal}
          className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 rounded-lg hover:bg-emerald-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          + Новая задача
        </button>
      </div>
    </header>
  );
};
