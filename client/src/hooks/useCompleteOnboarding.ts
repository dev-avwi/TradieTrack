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
  defaultHourlyRate?: string;  // Decimal type expects string
  calloutFee?: string;  // Decimal type expects string
  quoteValidityDays?: number;
}

function transformOnboardingData(data: OnboardingData): BusinessSettingsPayload {
  // Map onboarding data to backend schema field names
  return {
    // Business Profile fields
    businessName: data.businessProfile.companyName,
    abn: data.businessProfile.abn || undefined,
    phone: data.businessProfile.contactPhone || undefined,
    email: data.businessProfile.contactEmail || undefined,
    address: `${data.businessProfile.address}, ${data.businessProfile.city}, ${data.businessProfile.state} ${data.businessProfile.postcode}`.trim(),
    gstEnabled: data.businessProfile.gstRegistered,
    
    // Branding fields
    logoUrl: data.branding.logoUrl || undefined,
    primaryColor: data.branding.primaryColor || undefined,
    customThemeEnabled: data.branding.primaryColor ? true : false,
    quotePrefix: data.branding.quotePrefix || undefined,
    invoicePrefix: data.branding.invoicePrefix || undefined,
    
    // Default Rates fields - Convert numbers to strings for decimal fields
    defaultHourlyRate: data.defaultRates.hourlyRate.toString(),
    calloutFee: data.defaultRates.calloutFee.toString(),
    quoteValidityDays: data.defaultRates.quoteValidityPeriod,
  };
}

export function useCompleteOnboarding() {
  return useMutation({
    mutationFn: async (onboardingData: OnboardingData) => {
      const payload = transformOnboardingData(onboardingData);
      const response = await apiRequest('POST', '/api/business-settings', payload);
      return response.json();
    },
  });
}
