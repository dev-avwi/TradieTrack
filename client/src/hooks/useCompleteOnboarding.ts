import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { OnboardingData } from '@/components/OnboardingWizard';

interface BusinessSettingsPayload {
  businessName: string;
  abn?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  primaryColor?: string;
  customThemeEnabled?: boolean;
  quotePrefix?: string;
  invoicePrefix?: string;
  gstEnabled?: boolean;
  defaultHourlyRate?: string;
  calloutFee?: string;
  quoteValidityDays?: number;
  teamSize?: 'solo' | 'small' | 'medium' | 'large';
}

interface TeamInvitePayload {
  email: string;
  firstName?: string;
  lastName?: string;
  roleId: string;
}

interface UserRole {
  id: string;
  name: string;
  permissions: string[];
  description?: string;
  isActive: boolean;
}

function getTeamSizeFromInvitations(invitationCount: number): 'solo' | 'small' | 'medium' | 'large' {
  if (invitationCount === 0) return 'solo';
  if (invitationCount <= 5) return 'small';
  if (invitationCount <= 15) return 'medium';
  return 'large';
}

function transformOnboardingData(data: OnboardingData): BusinessSettingsPayload {
  const invitationCount = data.teamInvitation.inviteTeamMembers 
    ? data.teamInvitation.invitations.length 
    : 0;
  
  return {
    businessName: data.businessProfile.companyName,
    abn: data.businessProfile.abn || undefined,
    phone: data.businessProfile.contactPhone || undefined,
    email: data.businessProfile.contactEmail || undefined,
    address: `${data.businessProfile.address}, ${data.businessProfile.city}, ${data.businessProfile.state} ${data.businessProfile.postcode}`.trim(),
    gstEnabled: data.businessProfile.gstRegistered,
    logoUrl: data.branding.logoUrl || undefined,
    primaryColor: data.branding.primaryColor || undefined,
    customThemeEnabled: data.branding.primaryColor ? true : false,
    quotePrefix: data.branding.quotePrefix || undefined,
    invoicePrefix: data.branding.invoicePrefix || undefined,
    defaultHourlyRate: data.defaultRates.hourlyRate.toString(),
    calloutFee: data.defaultRates.calloutFee.toString(),
    quoteValidityDays: data.defaultRates.quoteValidityPeriod,
    teamSize: getTeamSizeFromInvitations(invitationCount),
  };
}

function findRoleIdByName(roles: UserRole[], roleName: string): string | null {
  const roleMap: Record<string, string[]> = {
    'admin': ['Administrator', 'Admin'],
    'employee': ['Technician', 'Staff', 'Apprentice'],
  };
  
  const searchNames = roleMap[roleName.toLowerCase()] || [roleName];
  const matchedRole = roles.find(r => 
    searchNames.some(name => r.name.toLowerCase() === name.toLowerCase())
  );
  
  return matchedRole?.id || null;
}

export interface OnboardingResult {
  settings: any;
  inviteResults?: {
    total: number;
    successful: number;
    failed: string[];
  };
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (onboardingData: OnboardingData): Promise<OnboardingResult> => {
      const payload = transformOnboardingData(onboardingData);
      const response = await apiRequest('POST', '/api/business-settings', payload);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create business settings');
      }
      
      const settingsResult = await response.json();
      
      const result: OnboardingResult = { settings: settingsResult };
      
      if (onboardingData.teamInvitation.inviteTeamMembers && 
          onboardingData.teamInvitation.invitations.length > 0) {
        
        const rolesResponse = await fetch('/api/team/roles');
        if (!rolesResponse.ok) {
          throw new Error('Failed to fetch team roles. Please try again.');
        }
        const roles: UserRole[] = await rolesResponse.json();
        
        const failedInvites: string[] = [];
        let successCount = 0;
        
        for (const invite of onboardingData.teamInvitation.invitations) {
          const roleId = findRoleIdByName(roles, invite.role);
          
          if (!roleId) {
            failedInvites.push(`${invite.email}: No matching role found for "${invite.role}"`);
            continue;
          }
          
          try {
            const invitePayload: TeamInvitePayload = {
              email: invite.email,
              roleId,
            };
            
            const inviteResponse = await apiRequest('POST', '/api/team/members/invite', invitePayload);
            if (!inviteResponse.ok) {
              const errorData = await inviteResponse.json().catch(() => ({}));
              failedInvites.push(`${invite.email}: ${errorData.error || 'Failed to send invite'}`);
            } else {
              successCount++;
            }
          } catch (error) {
            failedInvites.push(`${invite.email}: Network error`);
          }
        }
        
        result.inviteResults = {
          total: onboardingData.teamInvitation.invitations.length,
          successful: successCount,
          failed: failedInvites,
        };
        
        if (successCount === 0 && failedInvites.length > 0) {
          throw new Error(`All team invitations failed: ${failedInvites.join('; ')}`);
        }
      }
      
      return result;
    },
  });
}
