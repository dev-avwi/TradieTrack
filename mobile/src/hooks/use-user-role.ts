import { useState, useEffect } from 'react';
import api from '../lib/api';
import { useAuthStore } from '../lib/store';

export type UserRoleType = 'owner' | 'manager' | 'staff' | 'solo_owner' | 'loading';

interface TeamMemberInfo {
  roleId: string;
  roleName: string;
  permissions: string[];
}

export function useUserRole() {
  const { user, businessSettings } = useAuthStore();
  const [teamMemberInfo, setTeamMemberInfo] = useState<TeamMemberInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [roleCheckComplete, setRoleCheckComplete] = useState(false);
  const [is404Response, setIs404Response] = useState(false);

  useEffect(() => {
    async function fetchRoleInfo() {
      if (!user) {
        setIsLoading(false);
        setRoleCheckComplete(true);
        return;
      }

      try {
        const response = await api.get<TeamMemberInfo>('/api/team/my-role');
        setTeamMemberInfo(response.data || null);
        setIs404Response(false);
      } catch (error: any) {
        setTeamMemberInfo(null);
        setIs404Response(error?.response?.status === 404);
      } finally {
        setIsLoading(false);
        setRoleCheckComplete(true);
      }
    }

    fetchRoleInfo();
  }, [user?.id]);

  const getUserRole = (): UserRoleType => {
    if (isLoading) return 'loading';
    
    if (teamMemberInfo) {
      const roleName = teamMemberInfo.roleName.toLowerCase();
      
      if (roleName.includes('owner')) {
        return 'owner';
      }
      if (roleName.includes('manager') || roleName.includes('admin') || roleName.includes('supervisor')) {
        return 'manager';
      }
      return 'staff';
    }
    
    if (is404Response && businessSettings && user) {
      const settings = businessSettings as any;
      const isBusinessOwner = settings.userId === user.id || settings.user_id === user.id;
      
      if (isBusinessOwner) {
        const teamSize = settings.teamSize || settings.team_size || '1';
        if (teamSize === '1' || teamSize === 'solo') {
          return 'solo_owner';
        }
        return 'owner';
      }
    }
    
    return 'staff';
  };

  const role = getUserRole();
  const isResolved = roleCheckComplete && !isLoading;
  
  const isOwner = isResolved && (role === 'owner' || role === 'solo_owner');
  const isManager = isResolved && role === 'manager';
  const isStaff = !isResolved || role === 'staff';
  const isSolo = isResolved && role === 'solo_owner';
  const hasTeamAccess = isOwner || isManager;

  return {
    role: isResolved ? role : 'staff',
    isOwner,
    isManager,
    isStaff,
    isSolo,
    hasTeamAccess,
    isLoading,
    permissions: teamMemberInfo?.permissions || [],
    canAccessClients: isOwner || isManager,
    canAccessQuotes: isOwner || isManager,
    canAccessInvoices: isOwner || isManager,
    canAccessTeamManagement: hasTeamAccess,
    canAccessBilling: isOwner,
    canAccessSettings: isOwner || isManager,
    canAccessReports: isOwner || isManager,
    canAccessDispatch: hasTeamAccess,
    canAccessMap: true,
  };
}
