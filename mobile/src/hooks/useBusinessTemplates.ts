import { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../lib/store';
import { API_URL } from '../lib/api';

export interface BusinessTemplate {
  id: string;
  userId: string;
  family: 'email' | 'sms' | 'terms_conditions' | 'warranty' | 'safety_form' | 'checklist' | 'payment_notice';
  purpose: string;
  name: string;
  description: string | null;
  content: string;
  subject: string | null;
  isDefault: boolean;
  isActive: boolean;
  mergeFields: string[] | null;
  metadata: Record<string, unknown> | null;
  sections: unknown[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateFamilyMeta {
  family: string;
  count: number;
  activeTemplateId: string | null;
  activeTemplateName: string | null;
}

export type BusinessTemplateFamily = 'email' | 'sms' | 'terms_conditions' | 'warranty' | 'safety_form' | 'checklist' | 'payment_notice';
export type BusinessTemplatePurpose = 
  | 'quote_sent' | 'invoice_sent' | 'payment_reminder' | 'job_confirmation' | 'job_completed' 
  | 'quote_accepted' | 'quote_declined'
  | 'sms_quote_sent' | 'sms_invoice_sent' | 'sms_payment_reminder' | 'sms_job_confirmation' | 'sms_job_completed'
  | 'general';

export const PURPOSE_LABELS: Record<BusinessTemplatePurpose, string> = {
  quote_sent: 'Quote Sent',
  invoice_sent: 'Invoice Sent',
  payment_reminder: 'Payment Reminder',
  job_confirmation: 'Job Confirmation',
  job_completed: 'Job Completed',
  quote_accepted: 'Quote Accepted',
  quote_declined: 'Quote Declined',
  sms_quote_sent: 'Quote Sent',
  sms_invoice_sent: 'Invoice Sent',
  sms_payment_reminder: 'Payment Reminder',
  sms_job_confirmation: 'Job Confirmation',
  sms_job_completed: 'Job Completed',
  general: 'General',
};

export const FAMILY_CONFIG: Record<BusinessTemplateFamily, { name: string; description: string; category: string }> = {
  email: { name: 'Email Templates', description: 'Email communication templates', category: 'communications' },
  sms: { name: 'SMS Templates', description: 'Text message templates', category: 'communications' },
  terms_conditions: { name: 'Terms & Conditions', description: 'Quote and invoice terms', category: 'financial' },
  warranty: { name: 'Warranty Terms', description: 'Warranty statements', category: 'financial' },
  payment_notice: { name: 'Payment Notices', description: 'Payment reminder templates', category: 'financial' },
  safety_form: { name: 'Safety Forms', description: 'WHS compliance forms', category: 'jobs_safety' },
  checklist: { name: 'Job Checklists', description: 'Job completion checklists', category: 'jobs_safety' },
};

export const CATEGORIES = {
  communications: { name: 'Communications', families: ['email', 'sms'] as BusinessTemplateFamily[] },
  financial: { name: 'Financial', families: ['terms_conditions', 'warranty', 'payment_notice'] as BusinessTemplateFamily[] },
  jobs_safety: { name: 'Jobs & Safety', families: ['safety_form', 'checklist'] as BusinessTemplateFamily[] },
};

export function getPurposesForFamily(family: BusinessTemplateFamily): BusinessTemplatePurpose[] {
  if (family === 'email') {
    return ['quote_sent', 'invoice_sent', 'payment_reminder', 'job_confirmation', 'job_completed', 'quote_accepted', 'quote_declined'];
  }
  if (family === 'sms') {
    return ['sms_quote_sent', 'sms_invoice_sent', 'sms_payment_reminder', 'sms_job_confirmation', 'sms_job_completed'];
  }
  return ['general'];
}

export function useBusinessTemplates() {
  const { token } = useAuthStore();
  const [templates, setTemplates] = useState<BusinessTemplate[]>([]);
  const [familiesMeta, setFamiliesMeta] = useState<TemplateFamilyMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const [templatesRes, familiesRes] = await Promise.all([
        fetch(`${API_URL}/api/business-templates`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
        fetch(`${API_URL}/api/business-templates/families`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }),
      ]);

      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(data || []);
      }

      if (familiesRes.ok) {
        const data = await familiesRes.json();
        setFamiliesMeta(data || []);
      }
    } catch (err) {
      setError('Failed to load templates');
      console.error('Failed to fetch business templates:', err);
    }
    
    setIsLoading(false);
  }, [token]);

  const seedTemplates = useCallback(async () => {
    if (!token) return;
    
    try {
      await fetch(`${API_URL}/api/business-templates/seed`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to seed templates:', err);
    }
  }, [token, fetchTemplates]);

  const createTemplate = useCallback(async (data: {
    family: string;
    name: string;
    description?: string;
    content: string;
    subject?: string;
    purpose?: string;
  }) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/business-templates`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to create template');
    }

    await fetchTemplates();
    return response.json();
  }, [token, fetchTemplates]);

  const updateTemplate = useCallback(async (id: string, data: {
    name?: string;
    description?: string;
    content?: string;
    subject?: string;
    purpose?: string;
  }) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/business-templates/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || 'Failed to update template');
    }

    await fetchTemplates();
    return response.json();
  }, [token, fetchTemplates]);

  const deleteTemplate = useCallback(async (id: string) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/business-templates/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to delete template');
    }

    await fetchTemplates();
  }, [token, fetchTemplates]);

  const activateTemplate = useCallback(async (id: string) => {
    if (!token) throw new Error('Not authenticated');
    
    const response = await fetch(`${API_URL}/api/business-templates/${id}/activate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error('Failed to activate template');
    }

    await fetchTemplates();
  }, [token, fetchTemplates]);

  const getTemplatesForFamily = useCallback((family: BusinessTemplateFamily) => {
    return templates.filter(t => t.family === family);
  }, [templates]);

  const getFamilyMeta = useCallback((family: BusinessTemplateFamily) => {
    return familiesMeta.find(m => m.family === family);
  }, [familiesMeta]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (!isLoading && templates.length === 0 && familiesMeta.length === 0) {
      seedTemplates();
    }
  }, [isLoading, templates.length, familiesMeta.length, seedTemplates]);

  return {
    templates,
    familiesMeta,
    isLoading,
    error,
    refetch: fetchTemplates,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    activateTemplate,
    getTemplatesForFamily,
    getFamilyMeta,
  };
}
