'use client';

import React, { useState } from 'react';
import {
  Company,
  CrmLeadRecord,
  DashboardSection,
  OrganizationNode,
  TaskRecord,
} from '../types/database';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export interface LayoutProps {
  company: Company | null;
  nodes: OrganizationNode[];
  leads: CrmLeadRecord[];
  tasks: TaskRecord[];
  activeSection: DashboardSection;
  onSelectSection: (section: DashboardSection) => void;
  onOpenCreateModal: (targetSection?: DashboardSection) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  company,
  nodes,
  leads,
  tasks,
  activeSection,
  onSelectSection,
  onOpenCreateModal,
  children,
}) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  return (
    <div
      id="workspace"
      className="min-h-screen flex flex-col font-sans bg-slate-50 text-slate-900 antialiased"
    >
      <TopBar
        company={company}
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        onOpenCreateModal={() => onOpenCreateModal(activeSection)}
        onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
      />

      {/* Мобильный Offcanvas Drawer (< md) с затемнением bg-black/50 */}
      {isMobileSidebarOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Мобильное меню навигации TedCloud"
          className="fixed inset-0 z-50 flex md:hidden"
        >
          <div
            className="fixed inset-0 bg-black/50 transition-opacity duration-200"
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          <div className="relative z-10 flex h-full">
            <Sidebar
              company={company}
              nodes={nodes}
              leads={leads}
              tasks={tasks}
              activeSection={activeSection}
              onSelectSection={onSelectSection}
              onQuickCreateAction={(section) => onOpenCreateModal(section)}
              isMobileDrawer
              onCloseMobileDrawer={() => setIsMobileSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Основная рабочая сетка: Сайдбар + Контент */}
      <div className="flex-1 flex flex-col md:flex-row max-w-[1440px] w-full mx-auto">
        <Sidebar
          company={company}
          nodes={nodes}
          leads={leads}
          tasks={tasks}
          activeSection={activeSection}
          onSelectSection={onSelectSection}
          onQuickCreateAction={(section) => onOpenCreateModal(section)}
        />

        <main className="flex-1 w-full px-4 py-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:p-6 lg:p-8 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
};
