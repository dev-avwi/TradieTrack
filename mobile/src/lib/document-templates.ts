// Document Template System for Mobile
// Defines visual styles for quotes and invoices - matches web implementation

export type TemplateId = 'professional' | 'modern' | 'minimal';

export interface DocumentTemplate {
  id: TemplateId;
  name: string;
  description: string;
  headerLayout: 'classic' | 'modern' | 'minimal';
  colorScheme: 'brand' | 'neutral' | 'bold';
  tableStyle: 'bordered' | 'striped' | 'minimal';
  headingWeight: number;
  bodyWeight: number;
  borderRadius: number;
  headerBorderWidth: number;
  showHeaderDivider: boolean;
  sectionBackground: string;
  noteStyle: 'bordered' | 'highlighted' | 'simple';
}

export interface TemplateCustomization {
  tableStyle?: 'bordered' | 'striped' | 'minimal';
  noteStyle?: 'bordered' | 'highlighted' | 'simple';
  headerBorderWidth?: '1px' | '2px' | '3px' | '4px';
  showHeaderDivider?: boolean;
  bodyWeight?: 400 | 500 | 600 | 700;
  headingWeight?: 600 | 700 | 800;
  accentColor?: string;
}

export const DOCUMENT_TEMPLATES: Record<TemplateId, DocumentTemplate> = {
  professional: {
    id: 'professional',
    name: 'Professional',
    description: 'Traditional layout with bordered tables.',
    headerLayout: 'classic',
    colorScheme: 'neutral',
    tableStyle: 'bordered',
    headingWeight: 700,
    bodyWeight: 600,
    borderRadius: 2,
    headerBorderWidth: 2,
    showHeaderDivider: true,
    sectionBackground: '#f8f9fa',
    noteStyle: 'bordered',
  },
  modern: {
    id: 'modern',
    name: 'Modern',
    description: 'Clean design with bold brand colors.',
    headerLayout: 'modern',
    colorScheme: 'brand',
    tableStyle: 'striped',
    headingWeight: 700,
    bodyWeight: 600,
    borderRadius: 8,
    headerBorderWidth: 3,
    showHeaderDivider: true,
    sectionBackground: 'transparent',
    noteStyle: 'highlighted',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal',
    description: 'Ultra-clean design with subtle styling.',
    headerLayout: 'minimal',
    colorScheme: 'neutral',
    tableStyle: 'minimal',
    headingWeight: 700,
    bodyWeight: 600,
    borderRadius: 4,
    headerBorderWidth: 1,
    showHeaderDivider: false,
    sectionBackground: 'transparent',
    noteStyle: 'simple',
  },
};

// Fixed document accent color - consistent navy blue across all templates
export const DOCUMENT_ACCENT_COLOR = '#1e3a5f';
export const DEFAULT_TEMPLATE: TemplateId = 'minimal';

// Helper to get template styles for React Native
export function getTemplateStyles(
  templateId: TemplateId = 'minimal',
  _brandColor: string = '#2563eb',
  customization?: TemplateCustomization
) {
  const baseTemplate = DOCUMENT_TEMPLATES[templateId] || DOCUMENT_TEMPLATES.minimal;
  
  const template = {
    ...baseTemplate,
    tableStyle: customization?.tableStyle ?? baseTemplate.tableStyle,
    noteStyle: customization?.noteStyle ?? baseTemplate.noteStyle,
    headerBorderWidth: customization?.headerBorderWidth 
      ? parseInt(customization.headerBorderWidth) 
      : baseTemplate.headerBorderWidth,
    showHeaderDivider: customization?.showHeaderDivider ?? baseTemplate.showHeaderDivider,
    bodyWeight: customization?.bodyWeight ?? baseTemplate.bodyWeight,
    headingWeight: customization?.headingWeight ?? baseTemplate.headingWeight,
  };
  
  const primaryColor = customization?.accentColor || DOCUMENT_ACCENT_COLOR;
  
  return {
    template,
    primaryColor,
    accentColor: primaryColor,
    
    // Header styles
    headerStyle: {
      borderBottomWidth: template.showHeaderDivider ? template.headerBorderWidth : 0,
      borderBottomColor: primaryColor,
    },
    
    // Heading styles
    headingStyle: {
      fontWeight: String(template.headingWeight) as '600' | '700' | '800',
      color: primaryColor,
    },
    
    // Table header styles
    tableHeaderStyle: {
      backgroundColor: template.tableStyle === 'minimal' ? 'transparent' : primaryColor,
      color: template.tableStyle === 'minimal' ? '#1a1a1a' : '#ffffff',
    },
    
    // Table row styles
    getTableRowStyle: (index: number, isLast: boolean) => {
      const borderColor = isLast 
        ? primaryColor 
        : template.tableStyle === 'striped'
          ? 'transparent'
          : template.tableStyle === 'minimal'
            ? '#e5e7eb'
            : '#eeeeee';
      
      return {
        borderBottomWidth: isLast ? 2 : 1,
        borderBottomColor: borderColor,
        backgroundColor: template.tableStyle === 'striped' && index % 2 === 0 
          ? '#f9fafb' 
          : 'transparent',
      };
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
            borderLeftWidth: 4,
            borderLeftColor: primaryColor,
            backgroundColor: '#fafafa',
            borderRadius: 6,
          };
        case 'highlighted':
          return {
            backgroundColor: `${primaryColor}10`,
            borderWidth: 1,
            borderColor: `${primaryColor}30`,
            borderRadius: 8,
          };
        case 'simple':
        default:
          return {
            paddingVertical: 16,
            backgroundColor: 'transparent',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
          };
      }
    },
    
    borderRadius: template.borderRadius,
  };
}
