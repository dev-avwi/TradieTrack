import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface TemplateAnalysisResult {
  logo: {
    position: 'top-left' | 'top-center' | 'top-right' | 'none';
    approximate_size: 'small' | 'medium' | 'large' | 'none';
  };
  brandColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  layout: {
    header: {
      includes_company_name: boolean;
      includes_abn: boolean;
      includes_contact_info: boolean;
    };
    lineItems: {
      columns: string[];
      has_item_numbers: boolean;
    };
    totals: {
      position: 'bottom-right' | 'bottom-left' | 'bottom-center';
      shows_subtotal: boolean;
      shows_gst: boolean;
      shows_total: boolean;
    };
    footer: {
      has_terms: boolean;
      has_payment_details: boolean;
      has_signature_block: boolean;
    };
  };
  typography: {
    style: 'modern' | 'professional' | 'minimal';
  };
  detected_sections: string[];
  suggestedTemplateName: string;
}

export async function analyzeTemplate(
  imageBuffer: Buffer,
  templateType: 'quote' | 'invoice'
): Promise<TemplateAnalysisResult> {
  const base64Image = imageBuffer.toString('base64');
  
  const systemPrompt = `You are an expert document template analyzer. You analyze business documents (quotes and invoices) to extract their visual structure and styling. Focus on Australian business document conventions including ABN and GST handling.

You will be shown an image of a ${templateType} template. Analyze its structure and return a JSON object with the exact structure specified.`;

  const userPrompt = `Analyze this ${templateType} template image and extract its structure.

Return a JSON object with this exact structure:
{
  "logo": {
    "position": "top-left" | "top-center" | "top-right" | "none",
    "approximate_size": "small" | "medium" | "large" | "none"
  },
  "brandColors": {
    "primary": "#hex color code (main brand color, usually for headers)",
    "secondary": "#hex color code (secondary color)",
    "accent": "#hex color code (accent/highlight color)"
  },
  "layout": {
    "header": {
      "includes_company_name": true/false,
      "includes_abn": true/false,
      "includes_contact_info": true/false
    },
    "lineItems": {
      "columns": ["description", "quantity", "unit_price", "total", ...other columns detected],
      "has_item_numbers": true/false
    },
    "totals": {
      "position": "bottom-right" | "bottom-left" | "bottom-center",
      "shows_subtotal": true/false,
      "shows_gst": true/false,
      "shows_total": true/false
    },
    "footer": {
      "has_terms": true/false,
      "has_payment_details": true/false,
      "has_signature_block": true/false
    }
  },
  "typography": {
    "style": "modern" | "professional" | "minimal"
  },
  "detected_sections": ["header", "client_details", "line_items", "totals", "terms", "signature", ...any other sections],
  "suggestedTemplateName": "A descriptive name for this template based on its style"
}

For colors, extract the actual hex values you see. If a color isn't clearly visible, use sensible defaults:
- primary: #1e3a5f (navy blue) if not visible
- secondary: #4a5568 (gray) if not visible  
- accent: #2563eb (blue) if not visible

Important notes:
- ABN is Australian Business Number - look for 11-digit numbers formatted like XX XXX XXX XXX
- GST is Goods and Services Tax at 10% in Australia
- Common Australian ${templateType} sections include: client details, job/work description, itemized pricing, GST breakdown, payment terms, bank details`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: userPrompt },
            {
              type: "image_url",
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
                detail: "high"
              }
            }
          ]
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from AI');
    }

    const parsed = JSON.parse(content);
    
    // Validate and fill in defaults
    const result: TemplateAnalysisResult = {
      logo: {
        position: parsed.logo?.position || 'top-left',
        approximate_size: parsed.logo?.approximate_size || 'medium'
      },
      brandColors: {
        primary: parsed.brandColors?.primary || '#1e3a5f',
        secondary: parsed.brandColors?.secondary || '#4a5568',
        accent: parsed.brandColors?.accent || '#2563eb'
      },
      layout: {
        header: {
          includes_company_name: parsed.layout?.header?.includes_company_name ?? true,
          includes_abn: parsed.layout?.header?.includes_abn ?? false,
          includes_contact_info: parsed.layout?.header?.includes_contact_info ?? true
        },
        lineItems: {
          columns: parsed.layout?.lineItems?.columns || ['description', 'quantity', 'unit_price', 'total'],
          has_item_numbers: parsed.layout?.lineItems?.has_item_numbers ?? false
        },
        totals: {
          position: parsed.layout?.totals?.position || 'bottom-right',
          shows_subtotal: parsed.layout?.totals?.shows_subtotal ?? true,
          shows_gst: parsed.layout?.totals?.shows_gst ?? true,
          shows_total: parsed.layout?.totals?.shows_total ?? true
        },
        footer: {
          has_terms: parsed.layout?.footer?.has_terms ?? false,
          has_payment_details: parsed.layout?.footer?.has_payment_details ?? false,
          has_signature_block: parsed.layout?.footer?.has_signature_block ?? false
        }
      },
      typography: {
        style: parsed.typography?.style || 'professional'
      },
      detected_sections: parsed.detected_sections || ['header', 'line_items', 'totals'],
      suggestedTemplateName: parsed.suggestedTemplateName || `Analyzed ${templateType} template`
    };

    return result;
  } catch (error) {
    console.error('Template analysis error:', error);
    throw new Error(`Failed to analyze template: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
