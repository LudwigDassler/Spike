import React, { createContext, useContext, useMemo, useState } from 'react';
import { UserRole } from '../types/saas';

export interface RolePermissions {
  canViewCrmAndPv: boolean;
  canViewItTickets: boolean;
  canViewClientActions: boolean;
  canViewWhiteLabel: boolean;
  canViewPartnerNetwork: boolean;
}

export interface RoleContextValue extends RolePermissions {
  currentRole: UserRole;
  setCurrentRole: (role: UserRole) => void;
  roleDisplayLabel: string;
}

export function getPermissionsForRole(role: UserRole): RolePermissions {
  switch (role) {
    case 'SUPERADMIN':
      return {
        canViewCrmAndPv: true,
        canViewItTickets: true,
        canViewClientActions: true,
        canViewWhiteLabel: true,
        canViewPartnerNetwork: true,
      };
    case 'INTERNAL_IT':
      return {
        canViewCrmAndPv: false,
        canViewItTickets: true,
        canViewClientActions: false,
        canViewWhiteLabel: false,
        canViewPartnerNetwork: false,
      };
    case 'NETWORK_PARTNER':
    default:
      return {
        canViewCrmAndPv: true,
        canViewItTickets: false,
        canViewClientActions: true,
        canViewWhiteLabel: false,
        canViewPartnerNetwork: true,
      };
  }
}

export const ROLE_LABELS: Record<UserRole, string> = {
  NETWORK_PARTNER: 'Партнёр сети (NETWORK_PARTNER)',
  INTERNAL_IT: 'Разработчик / Поддержка (INTERNAL_IT)',
  SUPERADMIN: 'Администратор (SUPERADMIN)',
};

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export const RoleProvider: React.FC<{
  initialRole?: UserRole;
  children: React.ReactNode;
}> = ({ initialRole = 'NETWORK_PARTNER', children }) => {
  const [currentRole, setCurrentRole] = useState<UserRole>(initialRole);

  const value = useMemo<RoleContextValue>(() => {
    const perms = getPermissionsForRole(currentRole);
    return {
      currentRole,
      setCurrentRole,
      roleDisplayLabel: ROLE_LABELS[currentRole],
      ...perms,
    };
  }, [currentRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
};

export const CurrentRoleProvider = RoleProvider;

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error('useRole must be used within RoleProvider');
  }
  return ctx;
}

export const useCurrentRole = useRole;
