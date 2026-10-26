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
  children,
}) => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div
      id="workspace"
      className="min-h-screen flex font-sans bg-[#09090B] text-[#EDEDED] antialiased"
    >
      <Sidebar
        activeSection={activeSection}
        onSelectSection={onSelectSection}
        currentProfile={nodes[0] || null}
        counts={{
          tasks: tasks.length,
          nodes: nodes.length,
          leads: leads.length,
        }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          companyName={company?.name || 'TedCloud'}
          activeSection={activeSection}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isSyncing={false}
          onRefresh={() => {}}
        />

        <main className="flex-1 w-full px-6 py-6 min-w-0">{children}</main>
      </div>
    </div>
  );
};

