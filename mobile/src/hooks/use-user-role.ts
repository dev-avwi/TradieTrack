import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';

export type UserRoleType = 'owner' | 'manager' | 'staff' | 'solo_owner' | 'loading';

interface TeamMemberInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
}

interface BusinessSettings {
  id: string;
  userId: string;
  businessName: string;
  teamSize: string;
}

export function useUserRole() {
  const { user, businessSettings } = useAuthStore();
  const [teamMemberInfo, setTeamMemberInfo] = useState<TeamMemberInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRoleInfo() {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<TeamMemberInfo>('/api/team/my-role');
        setTeamMemberInfo(response.data || null);
      } catch (error) {
        setTeamMemberInfo(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRoleInfo();
  }, [user?.id]);

  const getUserRole = (): UserRoleType => {
    if (isLoading) return 'loading';
    
    if (teamMemberInfo) {
      const roleName = teamMemberInfo.roleName.toLowerCase();
      if (roleName.includes('manager') || roleName.includes('admin') || roleName.includes('supervisor')) {
        return 'manager';
      }
      return 'staff';
    }
    
    if (businessSettings && user && businessSettings.id) {
      const teamSize = businessSettings.teamSize || '1';
      if (teamSize === '1' || teamSize === 'solo') {
        return 'solo_owner';
      }
      return 'owner';
    }
    
    return 'owner';
  };

  const role = getUserRole();
  
  const isOwner = role === 'owner' || role === 'solo_owner';
  const isManager = role === 'manager';
  const isStaff = role === 'staff';
  const isSolo = role === 'solo_owner';
  const hasTeamAccess = role === 'owner' || role === 'manager';

  return {
    role,
    isOwner,
    isManager,
    isStaff,
    isSolo,
    hasTeamAccess,
    isLoading,
    permissions: teamMemberInfo?.permissions || [],
    canAccessClients: !isStaff,
    canAccessQuotes: !isStaff,
    canAccessInvoices: !isStaff,
    canAccessTeamManagement: isOwner || isManager,
    canAccessBilling: isOwner,
    canAccessSettings: !isStaff,
    canAccessReports: !isStaff,
    canAccessDispatch: hasTeamAccess,
    canAccessMap: true,
  };
}
