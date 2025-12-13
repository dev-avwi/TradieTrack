// Document Template System
// Defines visual styles for quotes and invoices

export type TemplateId = 'professional' | 'modern' | 'minimal';

export interface DocumentTemplate {
  id: TemplateId;
  name: string;
  description: string;
  fontFamily: string;
  headingFont: string;
  headerLayout: 'classic' | 'modern' | 'minimal';
  colorScheme: 'brand' | 'neutral' | 'bold';
  tableStyle: 'bordered' | 'striped' | 'minimal';
  // Typography settings
  baseFontSize: string;
  headingWeight: number;
  // Visual styling
  borderRadius: string;
  headerBorderWidth: string;
  showHeaderDivider: boolean;
  // Section styling
  sectionBackground: string;
  noteStyle: 'bordered' | 'highlighted' | 'simple';
}

export const DOCUMENT_TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Classic serif fonts with traditional layout. Perfect for formal business documents.',
    fontFamily: 'Georgia, "Times New Roman", Times, serif',
    headingFont: 'Georgia, "Times New Roman", Times, serif',
    headerLayout: 'classic',
    colorScheme: 'neutral',
    tableStyle: 'bordered',
    baseFontSize: '11px',
    headingWeight: 700,
    borderRadius: '2px',
    headerBorderWidth: '2px',
    showHeaderDivider: true,
    sectionBackground: '#f8f9fa',
    noteStyle: 'bordered',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean sans-serif design with bold brand colors. Great for contemporary businesses.',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    headingFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    headerLayout: 'modern',
    colorScheme: 'brand',
    tableStyle: 'striped',
    baseFontSize: '12px',
    headingWeight: 600,
    borderRadius: '8px',
    headerBorderWidth: '3px',
    showHeaderDivider: true,
    sectionBackground: 'transparent',
    noteStyle: 'highlighted',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean design with subtle styling. Lets your content speak for itself.',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    headingFont: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    headerLayout: 'minimal',
    colorScheme: 'neutral',
    tableStyle: 'minimal',
    baseFontSize: '11px',
    headingWeight: 500,
    borderRadius: '4px',
    headerBorderWidth: '1px',
    showHeaderDivider: false,
    sectionBackground: 'transparent',
    noteStyle: 'simple',
  },
};

// Helper to get template styles for inline application
export function getTemplateStyles(templateId: TemplateId, brandColor: string = '#2563eb') {
  const template = DOCUMENT_TEMPLATES[templateId] || DOCUMENT_TEMPLATES.professional;
  
  // Calculate color variants based on template color scheme
  const usesBrand = template.colorScheme === 'brand' || template.colorScheme === 'bold';
  const primaryColor = usesBrand ? brandColor : '#1a1a1a';
  const accentColor = usesBrand ? brandColor : '#4b5563';
  
  return {
    template,
    primaryColor,
    accentColor,
    // Container styles
    containerStyle: {
      fontFamily: template.fontFamily,
      fontSize: template.baseFontSize,
      lineHeight: '1.5',
      color: '#1a1a1a',
    },
    // Header styles
    headerStyle: {
      borderBottomWidth: template.headerBorderWidth,
      borderBottomStyle: 'solid' as const,
      borderBottomColor: template.showHeaderDivider ? primaryColor : 'transparent',
    },
    // Heading styles
    headingStyle: {
      fontFamily: template.headingFont,
      fontWeight: template.headingWeight,
      color: primaryColor,
    },
    // Table header styles
    tableHeaderStyle: {
      backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : primaryColor,
      color: template.tableStyle === 'minimal' ? '#1a1a1a' : '#ffffff',
      borderBottom: template.tableStyle === 'minimal' ? `2px solid ${primaryColor}` : 'none',
    },
    // Table row styles
    getTableRowStyle: (index: number, isLast: boolean) => {
      const base: React.CSSProperties = {
        borderBottom: isLast 
          ? `2px solid ${primaryColor}` 
          : template.tableStyle === 'bordered' 
            ? '1px solid #e5e7eb' 
            : template.tableStyle === 'striped' && index % 2 === 1 
              ? '1px solid #f3f4f6'
              : '1px solid #eee',
        backgroundColor: template.tableStyle === 'striped' && index % 2 === 1 
          ? '#f9fafb' 
          : 'transparent',
      };
      return base;
    },
    // Section styles
    sectionStyle: {
      backgroundColor: template.sectionBackground,
      borderRadius: template.borderRadius,
    },
    // Note styles
    getNoteStyle: () => {
      switch (template.noteStyle) {
        case 'bordered':
          return {
            borderLeft: `4px solid ${primaryColor}`,
            backgroundColor: '#fafafa',
            borderRadius: `0 ${template.borderRadius} ${template.borderRadius} 0`,
          };
        case 'highlighted':
          return {
            background: `linear-gradient(135deg, ${primaryColor}10, ${primaryColor}05)`,
            border: `1px solid ${primaryColor}30`,
            borderRadius: template.borderRadius,
          };
        case 'simple':
        default:
          return {
            borderTop: '1px solid #e5e7eb',
            paddingTop: '1rem',
          };
      }
    },
    // Border radius for cards/sections
    borderRadius: template.borderRadius,
  };
}

// Default template if none selected
export const DEFAULT_TEMPLATE: TemplateId = 'professional';
