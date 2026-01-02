import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY
});

export interface BusinessContext {
  businessName: string;
  trade: string;
  tradieFirstName: string;
  tradieEmail: string;
  openJobs: number;
  completedJobsThisMonth: number;
  overdueInvoices: number;
  unpaidInvoicesTotal: number;
  paidThisMonth: number;
  recentActivity: string[];
  todaysJobs: Array<{ id: number; title: string; clientName: string; clientId: number; address?: string; time?: string; status: string }>;
  upcomingJobs: Array<{ id: number; title: string; clientName: string; clientId: number; scheduledDate: string; status: string }>;
  overdueInvoicesList: Array<{ id: number; clientName: string; clientId: number; clientEmail?: string; clientPhone?: string; amount: number; daysPastDue: number; invoiceNumber?: string }>;
  recentClients: Array<{ id: number; name: string; email?: string; phone?: string }>;
  pendingQuotes: Array<{ id: number; clientName: string; clientId: number; clientEmail?: string; total: number; createdDaysAgo: number; quoteNumber?: string }>;
  recentInvoices: Array<{ id: number; clientName: string; amount: number; status: string; invoiceNumber?: string }>;
  recentQuotes: Array<{ id: number; clientName: string; amount: number; status: string; quoteNumber?: string }>;
  hasEmailSetup: boolean;
  emailAddress?: string;
  emailProvider?: 'smtp' | 'gmail' | 'platform';
  hasSmsSetup: boolean;
}

export interface AIAction {
  type: 'send_email' | 'send_invoice' | 'send_quote' | 'create_invoice' | 'create_quote' | 'create_job' | 'mark_job_complete' | 'navigate' | 'draft_message' | 'payment_reminder' | 'daily_summary' | 'plan_route' | 'view_job' | 'view_quote' | 'view_invoice' | 'view_client';
  data?: any;
  confirmationRequired?: boolean;
  message?: string;
}

// Rich content items that can be embedded in AI responses for interactive elements
export interface RichContentItem {
  type: 'job_link' | 'quote_link' | 'invoice_link' | 'client_link' | 'action_button';
  id: string;
  label: string;
  url?: string;
  action?: AIAction;
}

export interface RichChatResponse extends ChatResponse {
  richContent?: RichContentItem[];
}

export interface ChatResponse {
  response: string;
  action?: AIAction;
  suggestedFollowups?: string[];
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "send_email_to_client",
      description: "Send an email to a client. Use this when the tradie wants to follow up with a client, send a reminder, or communicate about a job/quote/invoice.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "The name of the client to email" },
          clientEmail: { type: "string", description: "The email address of the client (optional if known from context)" },
          subject: { type: "string", description: "Email subject line" },
          body: { type: "string", description: "Email body content in a professional but friendly tone" },
          emailType: { type: "string", enum: ["follow_up", "reminder", "quote", "invoice", "job_update", "thank_you", "general"], description: "The type of email being sent" }
        },
        required: ["clientName", "subject", "body", "emailType"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_existing_invoice",
      description: "Send an existing invoice to the client via email. Use when tradie wants to resend or send an invoice that already exists.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "number", description: "The ID of the invoice to send" },
          invoiceNumber: { type: "string", description: "The invoice number (optional)" },
          clientName: { type: "string", description: "The client's name" },
          message: { type: "string", description: "Optional additional message to include with the invoice" }
        },
        required: ["invoiceId", "clientName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_existing_quote",
      description: "Send an existing quote to the client via email. Use when tradie wants to resend or send a quote that already exists.",
      parameters: {
        type: "object",
        properties: {
          quoteId: { type: "number", description: "The ID of the quote to send" },
          quoteNumber: { type: "string", description: "The quote number (optional)" },
          clientName: { type: "string", description: "The client's name" },
          message: { type: "string", description: "Optional additional message to include with the quote" }
        },
        required: ["quoteId", "clientName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quick_invoice",
      description: "Help create a new invoice for a client. Use when tradie wants to invoice someone for work done.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "number", description: "The client's ID" },
          clientName: { type: "string", description: "The client's name" },
          description: { type: "string", description: "Description of the work/items" },
          amount: { type: "number", description: "Total amount in AUD" },
          dueInDays: { type: "number", description: "Number of days until due (default 14)" },
          fromJobId: { type: "number", description: "If invoicing from a job, the job ID" }
        },
        required: ["clientName", "description", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_quick_quote",
      description: "Help create a new quote for a client. Use when tradie wants to quote someone for potential work.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "number", description: "The client's ID" },
          clientName: { type: "string", description: "The client's name" },
          description: { type: "string", description: "Description of the work/items to quote" },
          amount: { type: "number", description: "Quoted amount in AUD" },
          validForDays: { type: "number", description: "Number of days quote is valid (default 30)" }
        },
        required: ["clientName", "description", "amount"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_job",
      description: "Help schedule a new job for a client. Use when tradie wants to book in work.",
      parameters: {
        type: "object",
        properties: {
          clientId: { type: "number", description: "The client's ID" },
          clientName: { type: "string", description: "The client's name" },
          title: { type: "string", description: "Job title/description" },
          scheduledDate: { type: "string", description: "When to schedule (e.g., 'tomorrow', 'next Monday', '2024-01-15')" },
          address: { type: "string", description: "Job site address (optional)" },
          notes: { type: "string", description: "Any notes about the job" },
          fromQuoteId: { type: "number", description: "If creating from an accepted quote, the quote ID" }
        },
        required: ["clientName", "title"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "mark_job_complete",
      description: "Mark a job as completed. Use when tradie says they've finished a job.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "number", description: "The job ID to mark complete" },
          jobTitle: { type: "string", description: "The job title (for confirmation)" },
          clientName: { type: "string", description: "The client's name (for confirmation)" },
          createInvoice: { type: "boolean", description: "Whether to also create an invoice for this job" }
        },
        required: ["jobId", "clientName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "send_payment_reminder",
      description: "Send a friendly payment reminder for an overdue invoice. Use when tradie wants to chase up payments.",
      parameters: {
        type: "object",
        properties: {
          invoiceId: { type: "number", description: "The invoice ID" },
          invoiceNumber: { type: "string", description: "The invoice number" },
          clientName: { type: "string", description: "The client's name" },
          clientEmail: { type: "string", description: "Client's email (optional)" },
          clientPhone: { type: "string", description: "Client's phone for SMS (optional)" },
          amount: { type: "number", description: "Amount owed" },
          daysPastDue: { type: "number", description: "How many days overdue" },
          reminderType: { type: "string", enum: ["gentle", "firm", "final"], description: "Tone of reminder based on how overdue" },
          channel: { type: "string", enum: ["email", "sms", "both"], description: "How to send the reminder" }
        },
        required: ["invoiceId", "clientName", "amount", "daysPastDue", "reminderType", "channel"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_daily_summary",
      description: "Generate a comprehensive daily summary of what's happening today and what needs attention. Use when tradie asks about their day or what they need to do.",
      parameters: {
        type: "object",
        properties: {
          includeFinancials: { type: "boolean", description: "Include money/invoice info" },
          includeUpcoming: { type: "boolean", description: "Include upcoming jobs beyond today" }
        }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "follow_up_quote",
      description: "Follow up on a pending quote that hasn't been accepted yet. Use when tradie wants to check in on a quote they sent.",
      parameters: {
        type: "object",
        properties: {
          quoteId: { type: "number", description: "The quote ID" },
          quoteNumber: { type: "string", description: "The quote number" },
          clientName: { type: "string", description: "Client's name" },
          clientEmail: { type: "string", description: "Client's email (optional)" },
          clientPhone: { type: "string", description: "Client's phone (optional)" },
          amount: { type: "number", description: "Quote amount" },
          daysSinceSent: { type: "number", description: "Days since quote was sent" },
          channel: { type: "string", enum: ["email", "sms", "both"], description: "How to follow up" }
        },
        required: ["quoteId", "clientName", "amount", "daysSinceSent", "channel"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "navigate_to_page",
      description: "Navigate the user to a specific page in the app like jobs, quotes, invoices, or create forms. Use when they want to view or create something.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "The app path: /dashboard, /jobs, /jobs/new, /jobs/:id, /quotes, /quotes/new, /quotes/:id, /invoices, /invoices/new, /invoices/:id, /clients, /clients/new, /clients/:id, /calendar, /settings, /settings/integrations" },
          reason: { type: "string", description: "Brief explanation of why navigating there" }
        },
        required: ["path", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "draft_message",
      description: "Draft a message for the tradie to review before sending. Use when they want help writing something but may want to edit it first.",
      parameters: {
        type: "object",
        properties: {
          clientName: { type: "string", description: "The name of the client" },
          messageType: { type: "string", enum: ["sms", "email"], description: "Whether this is for SMS or email" },
          subject: { type: "string", description: "Subject line (for email only)" },
          body: { type: "string", description: "The message content" },
          context: { type: "string", description: "What this message is about" }
        },
        required: ["clientName", "messageType", "body", "context"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "plan_route",
      description: "Open the map and plan an efficient route for today's jobs. Use when tradie asks about routing, efficient travel, planning their day's driving, or optimizing job order. This will open the map with multi-stop route planning.",
      parameters: {
        type: "object",
        properties: {
          jobs: { 
            type: "array", 
            description: "Array of jobs to include in the route, in suggested order",
            items: {
              type: "object",
              properties: {
                jobId: { type: "string", description: "The job ID" },
                title: { type: "string", description: "Job title" },
                clientName: { type: "string", description: "Client name" },
                address: { type: "string", description: "Job address" }
              }
            }
          },
          reason: { type: "string", description: "Brief explanation of the suggested route order" }
        },
        required: ["jobs", "reason"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_jobs_with_links",
      description: "Show a list of jobs with clickable links to view each one. Use when tradie asks to see their jobs, today's schedule, or what's on.",
      parameters: {
        type: "object",
        properties: {
          jobs: { 
            type: "array", 
            description: "Array of jobs to show",
            items: {
              type: "object",
              properties: {
                jobId: { type: "string", description: "The job ID" },
                title: { type: "string", description: "Job title" },
                clientName: { type: "string", description: "Client name" },
                address: { type: "string", description: "Job address (optional)" },
                time: { type: "string", description: "Scheduled time (optional)" },
                status: { type: "string", description: "Job status" }
              }
            }
          },
          summary: { type: "string", description: "Brief summary of the jobs" }
        },
        required: ["jobs", "summary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_quotes_with_links",
      description: "Show a list of quotes with clickable links to view each one. Use when tradie asks about their quotes or pending quotes.",
      parameters: {
        type: "object",
        properties: {
          quotes: { 
            type: "array", 
            description: "Array of quotes to show",
            items: {
              type: "object",
              properties: {
                quoteId: { type: "string", description: "The quote ID" },
                quoteNumber: { type: "string", description: "Quote number (optional)" },
                clientName: { type: "string", description: "Client name" },
                total: { type: "number", description: "Quote total" },
                status: { type: "string", description: "Quote status" },
                daysSinceSent: { type: "number", description: "Days since sent (optional)" }
              }
            }
          },
          summary: { type: "string", description: "Brief summary of the quotes" }
        },
        required: ["quotes", "summary"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "show_invoices_with_links",
      description: "Show a list of invoices with clickable links to view each one. Use when tradie asks about invoices, overdue payments, or outstanding amounts.",
      parameters: {
        type: "object",
        properties: {
          invoices: { 
            type: "array", 
            description: "Array of invoices to show",
            items: {
              type: "object",
              properties: {
                invoiceId: { type: "string", description: "The invoice ID" },
                invoiceNumber: { type: "string", description: "Invoice number (optional)" },
                clientName: { type: "string", description: "Client name" },
                amount: { type: "number", description: "Invoice amount" },
                status: { type: "string", description: "Invoice status (sent, overdue, paid, etc.)" },
                daysPastDue: { type: "number", description: "Days past due if overdue (optional)" }
              }
            }
          },
          summary: { type: "string", description: "Brief summary of the invoices" }
        },
        required: ["invoices", "summary"]
      }
    }
  }
];

export async function generateAISuggestions(context: BusinessContext): Promise<string[]> {
  try {
    const prompt = `You are TradieTrack AI, a helpful business assistant for ${context.tradieFirstName}, who runs ${context.businessName}, a ${context.trade} business in Australia.

Current Business State:
- Open Jobs: ${context.openJobs}
- Completed Jobs This Month: ${context.completedJobsThisMonth}
- Overdue Invoices: ${context.overdueInvoices} (totalling $${context.unpaidInvoicesTotal.toFixed(2)})
- Paid This Month: $${context.paidThisMonth.toFixed(2)}
- Today's Jobs: ${context.todaysJobs.length > 0 ? context.todaysJobs.map(j => `${j.title} for ${j.clientName}`).join(', ') : 'None scheduled'}
- Pending Quotes: ${context.pendingQuotes.length} waiting for response
- Email Setup: ${context.hasEmailSetup ? `Ready (via ${context.emailProvider === 'gmail' ? 'Gmail' : context.emailProvider === 'smtp' ? 'SMTP' : 'platform'})` : 'Not set up yet'}
- SMS Setup: ${context.hasSmsSetup ? 'Available' : 'Not available'}

${context.overdueInvoicesList.length > 0 ? `Overdue Invoices:
${context.overdueInvoicesList.slice(0, 3).map(i => `- ${i.clientName}: $${i.amount} (${i.daysPastDue} days overdue)`).join('\n')}` : ''}

${context.pendingQuotes.length > 0 ? `Pending Quotes:
${context.pendingQuotes.slice(0, 3).map(q => `- ${q.clientName}: $${q.total} (sent ${q.createdDaysAgo} days ago)`).join('\n')}` : ''}

Generate 4 specific, actionable suggestions to help ${context.tradieFirstName} right now. Focus on:
1. Urgent items (overdue payments, today's jobs)
2. Money-making opportunities (follow up pending quotes, send invoices)
3. Quick wins they can do in 2 minutes
4. Workflow efficiency (schedule jobs, complete admin)

Each suggestion should:
- Be 6-12 words maximum
- Start with an action verb
- Be immediately actionable
- Reference specific clients/amounts when relevant
- Use Australian English

Return ONLY a JSON object like: {"suggestions": ["suggestion 1", "suggestion 2", "suggestion 3", "suggestion 4"]}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_tokens: 400,
    });

    const content = response.choices[0]?.message?.content || '{"suggestions": []}';
    const parsed = JSON.parse(content);
    
    if (Array.isArray(parsed)) {
      return parsed.slice(0, 4);
    } else if (parsed.suggestions && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions.slice(0, 4);
    }
    
    return [];
  } catch (error) {
    console.error('AI suggestion generation error:', error);
    return [
      "Chase up overdue invoices",
      "Review pending quotes", 
      "Check today's schedule",
      "Send a quick invoice"
    ];
  }
}

export async function chatWithAI(message: string, context: BusinessContext): Promise<ChatResponse> {
  try {
    const systemPrompt = `You are TradieTrack AI, the powerful business assistant for ${context.tradieFirstName} who runs ${context.businessName}, a ${context.trade} business in Australia.

=== BUSINESS CONTEXT ===
Business: ${context.businessName} (${context.trade})
Owner: ${context.tradieFirstName}
Email: ${context.tradieEmail || 'Not set up'}
Email Integration: ${context.hasEmailSetup ? `Ready via ${context.emailProvider === 'gmail' ? 'Gmail connector' : context.emailProvider === 'smtp' ? 'your SMTP account' : 'platform email'}${context.emailAddress ? ` (${context.emailAddress})` : ''}` : 'Not connected - can set up in Settings > Integrations'}
SMS: Disabled for beta (coming soon)

=== FINANCIAL SNAPSHOT ===
Paid This Month: $${context.paidThisMonth.toFixed(2)}
Outstanding (Overdue): $${context.unpaidInvoicesTotal.toFixed(2)} across ${context.overdueInvoices} invoices
Open Jobs Value: Approx. based on ${context.openJobs} active jobs
Completed This Month: ${context.completedJobsThisMonth} jobs

=== TODAY'S JOBS ===
${context.todaysJobs.length > 0 
  ? context.todaysJobs.map(j => `• [ID:${j.id}] ${j.title} for ${j.clientName} (Client ID:${j.clientId})${j.address ? ` at ${j.address}` : ''}${j.time ? ` @ ${j.time}` : ''} - Status: ${j.status}`).join('\n')
  : 'No jobs scheduled for today'}

=== UPCOMING JOBS (Next 7 Days) ===
${context.upcomingJobs.length > 0 
  ? context.upcomingJobs.slice(0, 5).map(j => `• [ID:${j.id}] ${j.title} for ${j.clientName} on ${j.scheduledDate} - ${j.status}`).join('\n')
  : 'No upcoming jobs scheduled'}

=== OVERDUE INVOICES ===
${context.overdueInvoicesList.length > 0 
  ? context.overdueInvoicesList.map(i => `• [Invoice ID:${i.id}${i.invoiceNumber ? `, #${i.invoiceNumber}` : ''}] ${i.clientName} (Client ID:${i.clientId}): $${i.amount.toFixed(2)} - ${i.daysPastDue} days overdue${i.clientEmail ? ` - Email: ${i.clientEmail}` : ''}${i.clientPhone ? ` - Phone: ${i.clientPhone}` : ''}`).join('\n')
  : 'No overdue invoices - great work!'}

=== PENDING QUOTES ===
${context.pendingQuotes.length > 0 
  ? context.pendingQuotes.map(q => `• [Quote ID:${q.id}${q.quoteNumber ? `, #${q.quoteNumber}` : ''}] ${q.clientName} (Client ID:${q.clientId}): $${q.total.toFixed(2)} - sent ${q.createdDaysAgo} days ago${q.clientEmail ? ` - Email: ${q.clientEmail}` : ''}`).join('\n')
  : 'No pending quotes'}

=== RECENT CLIENTS ===
${context.recentClients.slice(0, 8).map(c => `• [ID:${c.id}] ${c.name}${c.email ? ` - ${c.email}` : ''}${c.phone ? ` - ${c.phone}` : ''}`).join('\n')}

=== RECENT INVOICES ===
${context.recentInvoices.slice(0, 5).map(i => `• [ID:${i.id}${i.invoiceNumber ? `, #${i.invoiceNumber}` : ''}] ${i.clientName}: $${i.amount.toFixed(2)} - ${i.status}`).join('\n')}

=== RECENT QUOTES ===
${context.recentQuotes.slice(0, 5).map(q => `• [ID:${q.id}${q.quoteNumber ? `, #${q.quoteNumber}` : ''}] ${q.clientName}: $${q.amount.toFixed(2)} - ${q.status}`).join('\n')}

=== YOUR SUPERPOWERS ===
You can do ALL of these for ${context.tradieFirstName}:

📧 COMMUNICATIONS:
- Send emails to any client (follow-ups, updates, thank yous)
- Send SMS texts for quick updates (on my way, running late, job done)
- Draft messages for review before sending

💰 INVOICING:
- Send existing invoices to clients
- Create quick invoices for work done
- Send payment reminders (gentle, firm, or final notice)
- Track who owes what and for how long

📝 QUOTES:
- Send existing quotes to clients
- Create quick quotes for new work
- Follow up on pending quotes that haven't been accepted

🔧 JOBS:
- Schedule new jobs for clients
- Mark jobs as complete
- Create invoices from completed jobs
- Give daily summaries of what's on

📊 INSIGHTS:
- Daily/weekly summaries
- Cash flow overview
- Who to chase, what to do next

🧭 NAVIGATION:
- Take them anywhere in the app (invoices, quotes, jobs, clients, settings)

=== PERSONALITY & RULES ===
- Be like a smart business mate who knows everything about their work
- Speak naturally in Australian English (mate, no worries, reckon, arvo, etc - but don't overdo it)
- Be ACTION-ORIENTED - always offer to do something, not just give info
- Keep responses SHORT (2-4 sentences max) unless asked for detail
- When they mention a client/job/invoice, look up the ID from context and use it
- For ${context.trade} businesses, show you understand their trade
- ALWAYS check context for client details before asking for them
- If email isn't set up and they want to send email, guide them to Settings > Integrations
- If something isn't possible, suggest an alternative
- When in doubt, offer to help with the most valuable action`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ],
      tools: tools,
      tool_choice: "auto",
      max_tokens: 600,
    });

    const responseMessage = response.choices[0]?.message;
    
    if (!responseMessage) {
      return { response: "I'm having trouble responding right now. Give it another go?" };
    }

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0] as any;
      const functionName = toolCall.function?.name;
      const functionArgs = JSON.parse(toolCall.function?.arguments || '{}');

      let action: AIAction | undefined;
      let followUpPrompt = "";

      switch (functionName) {
        case "send_email_to_client":
          action = {
            type: 'send_email',
            data: functionArgs,
            confirmationRequired: true,
            message: `Send email to ${functionArgs.clientName}`
          };
          followUpPrompt = `Ready to email ${functionArgs.clientName}!\n\n**Subject:** ${functionArgs.subject}\n\n**Message:**\n${functionArgs.body}\n\nWant me to send this?`;
          break;

        case "send_existing_invoice":
          action = {
            type: 'send_invoice',
            data: functionArgs,
            confirmationRequired: true,
            message: `Send invoice to ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll send ${functionArgs.invoiceNumber ? `Invoice #${functionArgs.invoiceNumber}` : 'the invoice'} to ${functionArgs.clientName}${functionArgs.message ? ` with your message` : ''}. Ready to send?`;
          break;

        case "send_existing_quote":
          action = {
            type: 'send_quote',
            data: functionArgs,
            confirmationRequired: true,
            message: `Send quote to ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll send ${functionArgs.quoteNumber ? `Quote #${functionArgs.quoteNumber}` : 'the quote'} to ${functionArgs.clientName}${functionArgs.message ? ` with your message` : ''}. Ready to send?`;
          break;

        case "create_quick_invoice":
          action = {
            type: 'create_invoice',
            data: functionArgs,
            confirmationRequired: true,
            message: `Create invoice for ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll create an invoice for ${functionArgs.clientName}:\n\n**${functionArgs.description}**\n**Amount:** $${functionArgs.amount.toFixed(2)} + GST\n**Due:** ${functionArgs.dueInDays || 14} days\n\nWant me to create this?`;
          break;

        case "create_quick_quote":
          action = {
            type: 'create_quote',
            data: functionArgs,
            confirmationRequired: true,
            message: `Create quote for ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll create a quote for ${functionArgs.clientName}:\n\n**${functionArgs.description}**\n**Amount:** $${functionArgs.amount.toFixed(2)} + GST\n**Valid for:** ${functionArgs.validForDays || 30} days\n\nWant me to create this?`;
          break;

        case "create_job":
          action = {
            type: 'create_job',
            data: functionArgs,
            confirmationRequired: true,
            message: `Schedule job for ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll schedule a job for ${functionArgs.clientName}:\n\n**${functionArgs.title}**${functionArgs.scheduledDate ? `\n**When:** ${functionArgs.scheduledDate}` : ''}${functionArgs.address ? `\n**Where:** ${functionArgs.address}` : ''}\n\nWant me to create this?`;
          break;

        case "mark_job_complete":
          action = {
            type: 'mark_job_complete',
            data: functionArgs,
            confirmationRequired: true,
            message: `Complete job for ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll mark ${functionArgs.jobTitle || 'the job'} for ${functionArgs.clientName} as complete.${functionArgs.createInvoice ? ' And create an invoice for it.' : ''}\n\nConfirm?`;
          break;

        case "send_payment_reminder":
          action = {
            type: 'payment_reminder',
            data: functionArgs,
            confirmationRequired: true,
            message: `Send payment reminder to ${functionArgs.clientName}`
          };
          const reminderTone = functionArgs.reminderType === 'gentle' ? 'friendly' : functionArgs.reminderType === 'firm' ? 'firm but professional' : 'final notice';
          followUpPrompt = `I'll send a ${reminderTone} payment reminder to ${functionArgs.clientName} for $${functionArgs.amount.toFixed(2)} (${functionArgs.daysPastDue} days overdue) via ${functionArgs.channel}.\n\nShall I send it?`;
          break;

        case "get_daily_summary":
          const summary = generateDailySummary(context, functionArgs);
          return {
            response: summary,
            suggestedFollowups: generateFollowups(context, 'daily_summary')
          };

        case "follow_up_quote":
          action = {
            type: 'send_email',
            data: {
              clientName: functionArgs.clientName,
              clientEmail: functionArgs.clientEmail,
              subject: `Following up on your quote`,
              body: generateQuoteFollowUp(functionArgs, context),
              emailType: 'follow_up',
              quoteId: functionArgs.quoteId
            },
            confirmationRequired: true,
            message: `Follow up on quote for ${functionArgs.clientName}`
          };
          followUpPrompt = `I'll follow up with ${functionArgs.clientName} about their $${functionArgs.amount.toFixed(2)} quote from ${functionArgs.daysSinceSent} days ago via ${functionArgs.channel}.\n\nReady to send?`;
          break;

        case "navigate_to_page":
          action = {
            type: 'navigate',
            data: functionArgs,
            confirmationRequired: false,
            message: functionArgs.reason
          };
          followUpPrompt = `Taking you to ${functionArgs.path.replace('/', '')}. ${functionArgs.reason}`;
          break;

        case "draft_message":
          action = {
            type: 'draft_message',
            data: functionArgs,
            confirmationRequired: false,
            message: `Draft prepared for ${functionArgs.clientName}`
          };
          followUpPrompt = `Here's a draft ${functionArgs.messageType} for ${functionArgs.clientName}:\n\n${functionArgs.subject ? `**Subject:** ${functionArgs.subject}\n\n` : ''}${functionArgs.body}\n\nWant me to send this or make changes?`;
          break;

        case "plan_route":
          // Create rich content with job links
          const routeJobs = functionArgs.jobs || [];
          const richContent: RichContentItem[] = routeJobs.map((job: any, index: number) => ({
            type: 'job_link' as const,
            id: job.jobId,
            label: `${index + 1}. ${job.title} - ${job.clientName}`,
            url: `/jobs/${job.jobId}`
          }));
          
          // Add action button for route planning
          richContent.push({
            type: 'action_button' as const,
            id: 'open_route',
            label: 'Open Route in Maps',
            action: {
              type: 'plan_route',
              data: { jobs: routeJobs },
              confirmationRequired: false
            }
          });

          action = {
            type: 'plan_route',
            data: { jobs: routeJobs, reason: functionArgs.reason },
            confirmationRequired: false,
            message: 'Opening route planner'
          };
          
          followUpPrompt = `Here's an efficient route for today:\n\n${routeJobs.map((job: any, i: number) => 
            `**${i + 1}. ${job.title}** for ${job.clientName}${job.address ? `\n   📍 ${job.address}` : ''}`
          ).join('\n\n')}\n\n${functionArgs.reason}\n\nTap any job to view details, or I'll open the map with this route.`;
          
          return {
            response: followUpPrompt,
            action,
            richContent,
            suggestedFollowups: ['Start navigating', 'Send ETAs to clients', 'View on map']
          } as RichChatResponse;

        case "show_jobs_with_links":
          const jobsList = functionArgs.jobs || [];
          const jobLinks: RichContentItem[] = jobsList.map((job: any) => ({
            type: 'job_link' as const,
            id: job.jobId,
            label: `${job.title} - ${job.clientName}`,
            url: `/jobs/${job.jobId}`
          }));
          
          followUpPrompt = `${functionArgs.summary}\n\n${jobsList.map((job: any) => 
            `• **${job.title}** for ${job.clientName}${job.time ? ` @ ${job.time}` : ''}${job.address ? `\n  📍 ${job.address}` : ''} - ${job.status}`
          ).join('\n\n')}\n\nTap any job to view details.`;
          
          return {
            response: followUpPrompt,
            richContent: jobLinks,
            suggestedFollowups: ['Plan route for these jobs', 'Send updates to clients', 'View calendar']
          } as RichChatResponse;

        case "show_quotes_with_links":
          const quotesList = functionArgs.quotes || [];
          const quoteLinks: RichContentItem[] = quotesList.map((quote: any) => ({
            type: 'quote_link' as const,
            id: quote.quoteId,
            label: `${quote.quoteNumber || 'Quote'} - ${quote.clientName} - $${quote.total.toFixed(2)}`,
            url: `/quotes/${quote.quoteId}`
          }));
          
          // Add action buttons for common actions
          if (quotesList.length > 0) {
            quoteLinks.push({
              type: 'action_button' as const,
              id: 'send_first_quote',
              label: `Send ${quotesList[0].quoteNumber || 'quote'} to ${quotesList[0].clientName}`,
              action: {
                type: 'send_quote',
                data: { quoteId: quotesList[0].quoteId, clientName: quotesList[0].clientName },
                confirmationRequired: true
              }
            });
          }
          
          followUpPrompt = `${functionArgs.summary}\n\n${quotesList.map((quote: any) => 
            `• **${quote.quoteNumber || 'Quote'}** - ${quote.clientName}: $${quote.total.toFixed(2)}${quote.daysSinceSent ? ` (${quote.daysSinceSent} days ago)` : ''} - ${quote.status}`
          ).join('\n')}\n\nTap any quote to view or send it.`;
          
          return {
            response: followUpPrompt,
            richContent: quoteLinks,
            suggestedFollowups: ['Follow up on oldest quote', 'Create new quote', 'View all quotes']
          } as RichChatResponse;

        case "show_invoices_with_links":
          const invoicesList = functionArgs.invoices || [];
          const invoiceLinks: RichContentItem[] = invoicesList.map((invoice: any) => ({
            type: 'invoice_link' as const,
            id: invoice.invoiceId,
            label: `${invoice.invoiceNumber || 'Invoice'} - ${invoice.clientName}`,
            status: invoice.status,
            url: `/invoices/${invoice.invoiceId}`
          }));
          
          // Add action button for sending payment reminder if overdue
          const overdueInvoice = invoicesList.find((i: any) => i.status?.toLowerCase() === 'overdue' || i.daysPastDue > 0);
          if (overdueInvoice) {
            invoiceLinks.push({
              type: 'action_button' as const,
              id: 'send_reminder',
              label: `Send payment reminder to ${overdueInvoice.clientName}`,
              action: {
                type: 'payment_reminder',
                data: { 
                  invoiceId: overdueInvoice.invoiceId, 
                  clientName: overdueInvoice.clientName,
                  amount: overdueInvoice.amount,
                  daysPastDue: overdueInvoice.daysPastDue || 0
                },
                confirmationRequired: true
              }
            });
          }
          
          followUpPrompt = `${functionArgs.summary}\n\n${invoicesList.map((invoice: any) => 
            `• **${invoice.invoiceNumber || 'Invoice'}** - ${invoice.clientName}: $${invoice.amount.toFixed(2)}${invoice.daysPastDue ? ` (${invoice.daysPastDue} days overdue)` : ''} - ${invoice.status}`
          ).join('\n')}\n\nTap any invoice to view or send a reminder.`;
          
          return {
            response: followUpPrompt,
            richContent: invoiceLinks,
            suggestedFollowups: ['Send reminder to oldest overdue', 'View all invoices', 'Create new invoice']
          } as RichChatResponse;
      }

      return {
        response: followUpPrompt,
        action,
        suggestedFollowups: generateFollowups(context, functionName)
      };
    }

    return {
      response: responseMessage.content || "I'm having trouble responding right now. Please try again.",
      suggestedFollowups: generateFollowups(context)
    };

  } catch (error) {
    console.error('AI chat error:', error);
    return { response: "I'm having a moment. Give it another shot?" };
  }
}

function generateDailySummary(context: BusinessContext, options: { includeFinancials?: boolean; includeUpcoming?: boolean }): string {
  const parts: string[] = [];
  
  parts.push(`**G'day ${context.tradieFirstName}! Here's your day:**\n`);
  
  // Today's jobs
  if (context.todaysJobs.length > 0) {
    parts.push(`📅 **Today's Jobs (${context.todaysJobs.length}):**`);
    context.todaysJobs.forEach(j => {
      parts.push(`• ${j.title} for ${j.clientName}${j.address ? ` at ${j.address}` : ''}${j.time ? ` @ ${j.time}` : ''}`);
    });
  } else {
    parts.push(`📅 **No jobs scheduled today** - good time to catch up on admin or book in new work!`);
  }
  
  // Money stuff
  if (options.includeFinancials !== false) {
    parts.push(`\n💰 **Money Matters:**`);
    if (context.overdueInvoices > 0) {
      parts.push(`• ${context.overdueInvoices} overdue invoices totalling $${context.unpaidInvoicesTotal.toFixed(2)} - worth chasing up!`);
      if (context.overdueInvoicesList.length > 0) {
        const top = context.overdueInvoicesList[0];
        parts.push(`• Biggest: ${top.clientName} owes $${top.amount.toFixed(2)} (${top.daysPastDue} days overdue)`);
      }
    } else {
      parts.push(`• No overdue invoices - nice work! 🎉`);
    }
    parts.push(`• Paid this month: $${context.paidThisMonth.toFixed(2)}`);
  }
  
  // Pending quotes
  if (context.pendingQuotes.length > 0) {
    parts.push(`\n📝 **${context.pendingQuotes.length} Pending Quotes:**`);
    context.pendingQuotes.slice(0, 3).forEach(q => {
      parts.push(`• ${q.clientName}: $${q.total.toFixed(2)} (${q.createdDaysAgo} days waiting)`);
    });
    parts.push(`Consider following up on quotes older than 7 days!`);
  }
  
  // Upcoming jobs
  if (options.includeUpcoming !== false && context.upcomingJobs.length > 0) {
    parts.push(`\n📆 **Coming Up:**`);
    context.upcomingJobs.slice(0, 3).forEach(j => {
      parts.push(`• ${j.scheduledDate}: ${j.title} for ${j.clientName}`);
    });
  }
  
  // Quick recommendations
  parts.push(`\n🎯 **Quick Wins:**`);
  if (context.overdueInvoices > 0) {
    parts.push(`• Send a payment reminder to your most overdue client`);
  }
  if (context.pendingQuotes.some(q => q.createdDaysAgo >= 7)) {
    parts.push(`• Follow up on quotes sent more than a week ago`);
  }
  if (context.todaysJobs.length > 0) {
    parts.push(`• Mark jobs complete when done and invoice straight away`);
  }
  
  return parts.join('\n');
}

function generateQuoteFollowUp(args: any, context: BusinessContext): string {
  return `Hi ${args.clientName.split(' ')[0]},

Just checking in about the quote I sent through ${args.daysSinceSent} days ago for $${args.amount.toFixed(2)}.

Happy to answer any questions or adjust anything if needed. Let me know if you'd like to go ahead or if there's anything I can help with.

Cheers,
${context.tradieFirstName}
${context.businessName}`;
}

function generateFollowups(context: BusinessContext, lastAction?: string): string[] {
  const followups: string[] = [];

  // Context-aware follow-ups based on last action
  if (lastAction === 'send_email_to_client') {
    followups.push("Send it now");
    followups.push("Make it shorter");
    return followups;
  }
  
  if (lastAction === 'daily_summary') {
    if (context.overdueInvoices > 0) followups.push("Chase my biggest overdue");
    if (context.pendingQuotes.length > 0) followups.push("Follow up oldest quote");
    if (context.todaysJobs.length > 0) followups.push("Show me today's jobs");
    return followups.slice(0, 3);
  }

  if (lastAction === 'create_quick_invoice' || lastAction === 'create_quick_quote') {
    followups.push("Create it");
    followups.push("Change the amount");
    return followups;
  }

  // Default smart follow-ups
  if (context.overdueInvoices > 0) {
    const top = context.overdueInvoicesList[0];
    if (top) followups.push(`Chase ${top.clientName}'s payment`);
  }
  
  if (context.todaysJobs.length > 0) {
    followups.push("What's my day look like?");
  }
  
  if (context.pendingQuotes.length > 0) {
    const oldestPending = context.pendingQuotes.find(q => q.createdDaysAgo >= 5);
    if (oldestPending) followups.push(`Follow up ${oldestPending.clientName}'s quote`);
  }

  if (followups.length < 3) {
    followups.push("Create a quick invoice");
  }
  
  if (followups.length < 3 && !context.hasEmailSetup) {
    followups.push("Set up my email");
  }

  return followups.slice(0, 3);
}

export async function executeAIAction(action: AIAction, userId: string): Promise<{ success: boolean; message: string }> {
  try {
    switch (action.type) {
      case 'send_email':
        return { success: true, message: "Email action queued for execution" };
      case 'send_invoice':
        return { success: true, message: "Invoice will be sent" };
      case 'send_quote':
        return { success: true, message: "Quote will be sent" };
      case 'create_invoice':
        return { success: true, message: "Invoice will be created" };
      case 'create_quote':
        return { success: true, message: "Quote will be created" };
      case 'create_job':
        return { success: true, message: "Job will be scheduled" };
      case 'mark_job_complete':
        return { success: true, message: "Job will be marked complete" };
      case 'payment_reminder':
        return { success: true, message: "Payment reminder will be sent" };
      case 'navigate':
        return { success: true, message: `Navigate to ${action.data?.path}` };
      case 'draft_message':
        return { success: true, message: "Draft prepared" };
      default:
        return { success: false, message: "Unknown action type" };
    }
  } catch (error) {
    console.error('AI action execution error:', error);
    return { success: false, message: "Failed to execute action" };
  }
}

// Email suggestion interface
export interface EmailSuggestionRequest {
  type: 'quote' | 'invoice';
  clientName: string;
  clientFirstName: string;
  documentNumber: string;
  documentTitle: string;
  total: string;
  businessName?: string;
}

export interface EmailSuggestionResponse {
  subject: string;
  greeting: string;
  body: string;
  closing: string;
  fullMessage: string;
}

// Generate AI-powered email suggestion in Australian English
export async function generateEmailSuggestion(
  request: EmailSuggestionRequest
): Promise<EmailSuggestionResponse> {
  const { type, clientName, clientFirstName, documentNumber, documentTitle, total, businessName } = request;
  
  const docType = type === 'quote' ? 'quote' : 'invoice';
  const formattedTotal = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
  }).format(parseFloat(total) || 0);

  const systemPrompt = `You are an Australian tradesperson writing professional but friendly emails to clients. 

CRITICAL RULES:
1. Use Australian English spelling (e.g., "organise" not "organize", "colour" not "color", "favour" not "favor")
2. Use Australian expressions naturally (e.g., "G'day", "No worries", "Cheers", "give us a bell", "happy to help")
3. Be warm and professional - tradies are often dealing with home owners who appreciate a friendly approach
4. Keep it concise - tradies are busy, clients appreciate brevity
5. NEVER use American expressions or spelling
6. Currency is always AUD with $ symbol
7. Be genuine and personable, not corporate or stiff

Your response must be valid JSON with these fields:
- subject: Email subject line (professional, includes document number)
- greeting: Opening line (e.g., "G'day [name],")
- body: Main message content (2-4 paragraphs, conversational)
- closing: Sign-off (e.g., "Cheers", "Thanks mate", "All the best")
- fullMessage: Complete email combining greeting, body and closing with proper line breaks`;

  const userPrompt = type === 'quote' 
    ? `Write an email to send a quote to ${clientName}. 
       Quote Number: ${documentNumber}
       Project: ${documentTitle}
       Total: ${formattedTotal}
       Business: ${businessName || 'my business'}
       
       The email should thank them for their enquiry, briefly mention what the quote covers, and invite them to get in touch with any questions. Make it feel personal and not like a template.`
    : `Write an email to send an invoice to ${clientName}.
       Invoice Number: ${documentNumber}
       For: ${documentTitle}
       Total: ${formattedTotal}
       Business: ${businessName || 'my business'}
       
       The email should thank them for their business, mention what the invoice is for, and let them know they can pay online. Keep it friendly but professional.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(responseText);
    
    return {
      subject: parsed.subject || `${type === 'quote' ? 'Quote' : 'Invoice'} #${documentNumber} from ${businessName || 'us'}`,
      greeting: parsed.greeting || `G'day ${clientFirstName},`,
      body: parsed.body || '',
      closing: parsed.closing || 'Cheers',
      fullMessage: parsed.fullMessage || `${parsed.greeting}\n\n${parsed.body}\n\n${parsed.closing}`
    };
  } catch (error) {
    console.error('AI email suggestion error:', error);
    
    // Fallback to default Australian-style message
    const defaultMessages = {
      quote: {
        subject: `Quote #${documentNumber} from ${businessName || 'us'} - ${documentTitle}`,
        greeting: `G'day ${clientFirstName},`,
        body: `Thanks for getting in touch! I've put together a quote for the ${documentTitle.toLowerCase()} work we discussed.\n\nThe total comes to ${formattedTotal}. I've included all the details in the attached quote - have a squiz and let me know if you've got any questions.\n\nIf it all looks good, you can accept it online with the link below. Happy to chat through anything if needed - just give us a bell.`,
        closing: `Cheers`,
        fullMessage: `G'day ${clientFirstName},\n\nThanks for getting in touch! I've put together a quote for the ${documentTitle.toLowerCase()} work we discussed.\n\nThe total comes to ${formattedTotal}. I've included all the details in the attached quote - have a squiz and let me know if you've got any questions.\n\nIf it all looks good, you can accept it online with the link below. Happy to chat through anything if needed - just give us a bell.\n\nCheers`
      },
      invoice: {
        subject: `Invoice #${documentNumber} from ${businessName || 'us'} - ${documentTitle}`,
        greeting: `G'day ${clientFirstName},`,
        body: `Thanks for choosing us for your ${documentTitle.toLowerCase()} work!\n\nI've attached the invoice for ${formattedTotal}. You can pay online using the secure link below - it only takes a minute.\n\nIf you have any questions about the invoice, just give me a shout.`,
        closing: `Thanks for your business!\n\nCheers`,
        fullMessage: `G'day ${clientFirstName},\n\nThanks for choosing us for your ${documentTitle.toLowerCase()} work!\n\nI've attached the invoice for ${formattedTotal}. You can pay online using the secure link below - it only takes a minute.\n\nIf you have any questions about the invoice, just give me a shout.\n\nThanks for your business!\n\nCheers`
      }
    };
    
    return defaultMessages[type];
  }
}

// AI Scheduling Types
export interface ScheduleJob {
  id: string;
  title: string;
  clientName: string;
  clientId: string;
  address?: string;
  estimatedDuration?: number; // minutes
  priority?: string;
  latitude?: number;
  longitude?: number;
}

export interface TeamMemberAvailability {
  id: string;
  name: string;
  scheduledMinutes: number; // minutes already scheduled for the day
  capacity: number; // max minutes (default 480 = 8 hours)
  scheduledJobs: Array<{ time: string; title: string }>;
}

export interface ScheduleSuggestion {
  jobId: string;
  jobTitle: string;
  clientName: string;
  suggestedDate: string; // YYYY-MM-DD
  suggestedTime: string; // HH:MM
  suggestedAssignee?: string; // team member id
  suggestedAssigneeName?: string;
  reason: string;
  priority: number; // 1 = highest
}

export interface ScheduleContext {
  businessName: string;
  tradeName: string;
  unscheduledJobs: ScheduleJob[];
  teamAvailability: TeamMemberAvailability[];
  targetDate: string; // YYYY-MM-DD - date to schedule for
  existingJobsForDate: Array<{ 
    id: string; 
    title: string; 
    time: string; 
    assignedTo?: string;
    address?: string;
  }>;
}

export interface ScheduleSuggestionsResponse {
  suggestions: ScheduleSuggestion[];
  summary: string;
  optimizationNotes?: string[];
}

// Generate AI-powered scheduling suggestions
export async function generateScheduleSuggestions(
  context: ScheduleContext
): Promise<ScheduleSuggestionsResponse> {
  const { businessName, tradeName, unscheduledJobs, teamAvailability, targetDate, existingJobsForDate } = context;

  // If no unscheduled jobs, return empty
  if (unscheduledJobs.length === 0) {
    return {
      suggestions: [],
      summary: "All jobs are already scheduled. Nice one!",
      optimizationNotes: []
    };
  }

  const systemPrompt = `You are an AI scheduling assistant for ${businessName}, an Australian ${tradeName} business.

Your task is to suggest optimal scheduling for unscheduled jobs based on:
1. Team member availability and current workload
2. Job locations (group nearby jobs together to minimize travel)
3. Job duration and priority
4. Existing scheduled jobs for the day

Guidelines:
- Prefer scheduling high-priority jobs earlier in the day
- Group jobs in similar locations for the same team member
- Leave buffer time between jobs (don't schedule back-to-back tight)
- Consider travel time between job sites
- Balance workload across team members
- Standard work hours are 6:00 AM to 8:00 PM
- Use Australian time format (24-hour or AM/PM)

Return a JSON response with this exact structure:
{
  "suggestions": [
    {
      "jobId": "job-id-here",
      "jobTitle": "Job Title",
      "clientName": "Client Name",
      "suggestedDate": "YYYY-MM-DD",
      "suggestedTime": "HH:MM",
      "suggestedAssignee": "member-id or null for owner",
      "suggestedAssigneeName": "Team Member Name",
      "reason": "Brief explanation of why this time/person was suggested",
      "priority": 1
    }
  ],
  "summary": "Brief summary of the scheduling recommendations",
  "optimizationNotes": ["Note about route optimization", "Note about workload balancing"]
}`;

  const userPrompt = `Please suggest optimal scheduling for these unscheduled jobs for ${targetDate}:

UNSCHEDULED JOBS (${unscheduledJobs.length}):
${unscheduledJobs.map((job, i) => `${i + 1}. [ID: ${job.id}] "${job.title}" for ${job.clientName}
   - Duration: ${job.estimatedDuration || 60} minutes
   - Address: ${job.address || 'Not specified'}
   - Priority: ${job.priority || 'normal'}
   ${job.latitude && job.longitude ? `- Location: ${job.latitude}, ${job.longitude}` : ''}`).join('\n\n')}

TEAM AVAILABILITY FOR ${targetDate}:
${teamAvailability.map(tm => `- ${tm.name}: ${tm.scheduledMinutes}/${tm.capacity} minutes used
  Already has: ${tm.scheduledJobs.length > 0 ? tm.scheduledJobs.map(j => `${j.time} - ${j.title}`).join(', ') : 'No jobs scheduled'}`).join('\n')}

EXISTING SCHEDULED JOBS FOR ${targetDate}:
${existingJobsForDate.length > 0 
  ? existingJobsForDate.map(j => `- ${j.time}: "${j.title}" ${j.assignedTo ? `(assigned to ${j.assignedTo})` : '(owner)'} at ${j.address || 'no address'}`).join('\n')
  : 'No jobs currently scheduled for this date'}

Suggest the best times and team members for each unscheduled job. Consider location clustering, workload balance, and travel efficiency.`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(responseText);
    
    return {
      suggestions: parsed.suggestions || [],
      summary: parsed.summary || 'AI scheduling suggestions generated',
      optimizationNotes: parsed.optimizationNotes || []
    };
  } catch (error) {
    console.error('AI scheduling suggestion error:', error);
    
    // Fallback: simple sequential scheduling
    const fallbackSuggestions: ScheduleSuggestion[] = unscheduledJobs.slice(0, 5).map((job, index) => {
      const hour = 8 + (index * 2); // Start at 8 AM, 2-hour gaps
      return {
        jobId: job.id,
        jobTitle: job.title,
        clientName: job.clientName,
        suggestedDate: targetDate,
        suggestedTime: `${hour.toString().padStart(2, '0')}:00`,
        suggestedAssignee: teamAvailability[0]?.id,
        suggestedAssigneeName: teamAvailability[0]?.name || 'Owner',
        reason: 'Scheduled based on available time slot',
        priority: index + 1
      };
    });

    return {
      suggestions: fallbackSuggestions,
      summary: 'Generated basic schedule suggestions (AI unavailable)',
      optimizationNotes: ['Consider grouping nearby jobs together']
    };
  }
}

// ============================
// STANDOUT FEATURES - AI Quote Generator, Next Actions, Instant Job Parser
// ============================

export interface QuoteLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: 'labour' | 'materials' | 'equipment' | 'other';
}

export interface AIQuoteFromMediaResult {
  success: boolean;
  jobType: string;
  description: string;
  lineItems: QuoteLineItem[];
  totalEstimate: number;
  gstAmount: number;
  grandTotal: number;
  confidence: 'high' | 'medium' | 'low';
  notes: string[];
  suggestedTitle: string;
}

/**
 * AI Quote Generator from Photos + Voice
 * Analyzes job photos and voice transcription to auto-generate quote line items
 */
export async function generateQuoteFromMedia(params: {
  photoUrls?: string[];
  voiceTranscription?: string;
  jobDescription?: string;
  tradeType: string;
  businessName: string;
}): Promise<AIQuoteFromMediaResult> {
  const { photoUrls = [], voiceTranscription, jobDescription, tradeType, businessName } = params;

  const systemPrompt = `You are an expert ${tradeType} estimator for ${businessName} in Australia. 
Analyze the provided information (photos description and/or voice notes) to generate accurate quote line items.

PRICING GUIDELINES FOR AUSTRALIAN ${tradeType.toUpperCase()}:
- Labour rates: $80-150/hour depending on complexity
- Materials: Use current Australian trade supplier pricing
- Call-out/minimum fee: $80-150 for small jobs
- Include travel if applicable

Always:
- Use Australian English
- Include all materials and labour separately
- Be specific with item descriptions
- Round to nearest $5 for line items
- Include GST (10%) calculation
- Err on the side of realistic pricing (not too cheap, not too expensive)

Return a JSON object with this exact structure:
{
  "jobType": "Brief job type (e.g., 'Hot Water System Replacement')",
  "description": "Professional job description for the quote",
  "suggestedTitle": "Short title for the quote (max 50 chars)",
  "lineItems": [
    {
      "description": "Item description",
      "quantity": 1,
      "unitPrice": 100.00,
      "total": 100.00,
      "category": "labour|materials|equipment|other"
    }
  ],
  "totalEstimate": 500.00,
  "gstAmount": 50.00,
  "grandTotal": 550.00,
  "confidence": "high|medium|low",
  "notes": ["Any important notes", "Assumptions made"]
}`;

  let userPrompt = `Please analyze this job and generate quote line items:\n\n`;
  userPrompt += `TRADE: ${tradeType}\n\n`;

  if (jobDescription) {
    userPrompt += `JOB DESCRIPTION:\n${jobDescription}\n\n`;
  }

  if (voiceTranscription) {
    userPrompt += `VOICE NOTE FROM TRADIE:\n"${voiceTranscription}"\n\n`;
  }

  userPrompt += `Generate detailed quote line items with realistic Australian pricing.`;

  try {
    // Build message content - either text-only or multimodal with images
    type ContentPart = { type: "text"; text: string } | { type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } };
    let userContent: string | ContentPart[];

    if (photoUrls.length > 0) {
      // Use multimodal content with images for GPT-4o vision
      const contentParts: ContentPart[] = [
        { type: "text", text: userPrompt + `\n\nPlease analyze the ${photoUrls.length} photo(s) below to assess the job and provide accurate pricing:` }
      ];

      // Add each photo URL as an image content part
      for (const photoUrl of photoUrls.slice(0, 5)) { // Limit to 5 photos to avoid token limits
        contentParts.push({
          type: "image_url",
          image_url: { url: photoUrl, detail: "low" }
        });
      }

      userContent = contentParts;
    } else {
      userContent = userPrompt;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.7,
      max_tokens: 1500,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '{}';
    
    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      console.error('Failed to parse AI response:', responseText);
      return {
        success: false,
        jobType: 'Unknown',
        description: '',
        suggestedTitle: 'Quote',
        lineItems: [],
        totalEstimate: 0,
        gstAmount: 0,
        grandTotal: 0,
        confidence: 'low',
        notes: ['AI response was not valid JSON. Please try again.']
      };
    }

    // Validate and normalize line items
    const lineItems: QuoteLineItem[] = (parsed.lineItems || [])
      .filter((item: any) => item && typeof item === 'object' && item.description)
      .map((item: any) => ({
        description: String(item.description || ''),
        quantity: Math.max(1, Number(item.quantity) || 1),
        unitPrice: Math.max(0, Number(item.unitPrice) || 0),
        total: Math.max(0, Number(item.total) || (Number(item.quantity || 1) * Number(item.unitPrice || 0))),
        category: ['labour', 'materials', 'equipment', 'other'].includes(item.category) 
          ? item.category 
          : 'other'
      }));

    // Recalculate totals server-side to ensure accuracy
    const calculatedSubtotal = lineItems.reduce((sum, item) => sum + item.total, 0);
    const calculatedGst = calculatedSubtotal * 0.10;
    const calculatedTotal = calculatedSubtotal + calculatedGst;

    return {
      success: true,
      jobType: String(parsed.jobType || 'General Work'),
      description: String(parsed.description || ''),
      suggestedTitle: String(parsed.suggestedTitle || parsed.jobType || 'Quote').substring(0, 50),
      lineItems,
      totalEstimate: Math.round(calculatedSubtotal * 100) / 100,
      gstAmount: Math.round(calculatedGst * 100) / 100,
      grandTotal: Math.round(calculatedTotal * 100) / 100,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'medium',
      notes: Array.isArray(parsed.notes) ? parsed.notes.map(String).slice(0, 5) : []
    };
  } catch (error) {
    console.error('AI quote generation error:', error);
    return {
      success: false,
      jobType: 'Unknown',
      description: '',
      suggestedTitle: 'Quote',
      lineItems: [],
      totalEstimate: 0,
      gstAmount: 0,
      grandTotal: 0,
      confidence: 'low',
      notes: ['AI quote generation failed. Please enter items manually.']
    };
  }
}

export interface NextAction {
  action: string;
  priority: 'high' | 'medium' | 'low';
  actionType: 'send_invoice' | 'send_quote' | 'follow_up' | 'schedule' | 'complete' | 'collect_payment' | 'add_photos' | 'send_confirmation';
  reason: string;
}

/**
 * Generate "Next Best Action" suggestions for a job
 * Shows tradies exactly what to do next
 */
export async function generateJobNextAction(params: {
  jobStatus: string;
  jobTitle: string;
  clientName: string;
  hasQuote: boolean;
  quoteStatus?: string;
  hasInvoice: boolean;
  invoiceStatus?: string;
  daysSinceCreated: number;
  daysSinceLastUpdate: number;
  hasPhotos: boolean;
  scheduledAt?: Date | null;
  completedAt?: Date | null;
}): Promise<NextAction> {
  const {
    jobStatus,
    jobTitle,
    clientName,
    hasQuote,
    quoteStatus,
    hasInvoice,
    invoiceStatus,
    daysSinceCreated,
    daysSinceLastUpdate,
    hasPhotos,
    scheduledAt,
    completedAt
  } = params;

  // Rule-based next action logic (fast, no AI call needed)
  
  // Job is done but no invoice
  if (jobStatus === 'done' && !hasInvoice) {
    return {
      action: 'Create & send invoice',
      priority: 'high',
      actionType: 'send_invoice',
      reason: 'Job completed - time to get paid!'
    };
  }

  // Job is done, has invoice but unpaid
  if (jobStatus === 'done' && hasInvoice && invoiceStatus !== 'paid') {
    const isOverdue = invoiceStatus === 'overdue';
    return {
      action: isOverdue ? 'Chase payment' : 'Send payment reminder',
      priority: isOverdue ? 'high' : 'medium',
      actionType: 'collect_payment',
      reason: isOverdue ? 'Invoice is overdue!' : 'Invoice sent, awaiting payment'
    };
  }

  // Job is pending with no schedule
  if (jobStatus === 'pending' && !scheduledAt) {
    return {
      action: 'Schedule this job',
      priority: 'medium',
      actionType: 'schedule',
      reason: 'Job needs a date and time'
    };
  }

  // Job is scheduled for today or past - should be in progress
  if (jobStatus === 'scheduled' && scheduledAt) {
    const isToday = new Date(scheduledAt).toDateString() === new Date().toDateString();
    const isPast = new Date(scheduledAt) < new Date();
    if (isToday || isPast) {
      return {
        action: 'Start job / Mark in progress',
        priority: 'high',
        actionType: 'complete',
        reason: isToday ? 'Job scheduled for today' : 'Job was scheduled - update status'
      };
    }
  }

  // Job in progress - prompt to complete
  if (jobStatus === 'in_progress') {
    return {
      action: hasPhotos ? 'Mark job complete' : 'Add photos & complete',
      priority: 'medium',
      actionType: hasPhotos ? 'complete' : 'add_photos',
      reason: hasPhotos ? 'Ready to mark as done' : 'Add job photos before completing'
    };
  }

  // Quote sent but not accepted
  if (hasQuote && quoteStatus === 'sent' && daysSinceLastUpdate > 3) {
    return {
      action: 'Follow up on quote',
      priority: 'medium',
      actionType: 'follow_up',
      reason: `Quote sent ${daysSinceLastUpdate} days ago`
    };
  }

  // Default for pending/new jobs
  if (jobStatus === 'pending' && !hasQuote) {
    return {
      action: 'Create quote',
      priority: 'medium',
      actionType: 'send_quote',
      reason: 'Send quote to confirm the job'
    };
  }

  // Default fallback
  return {
    action: 'Review job details',
    priority: 'low',
    actionType: 'follow_up',
    reason: 'Check if any updates needed'
  };
}

export interface ParsedJobFromText {
  success: boolean;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  address?: string;
  description: string;
  suggestedTitle: string;
  urgency: 'urgent' | 'normal' | 'flexible';
  extractedDetails: string[];
}

/**
 * Instant Job Creation from Text
 * Parse a pasted SMS, email, or message to extract job details
 */
export async function parseJobFromText(text: string, tradeType: string): Promise<ParsedJobFromText> {
  const systemPrompt = `You are a smart assistant for a ${tradeType} business in Australia.
Parse the message below to extract job details. Look for:
- Client name (person's name)
- Phone number (Australian format: 04XX XXX XXX or similar)
- Email address
- Address/location (Australian suburb/street format)
- Job description/issue
- Urgency indicators (ASAP, urgent, emergency, when available, etc.)

Return a JSON object:
{
  "success": true,
  "clientName": "Name if found or null",
  "clientPhone": "Phone if found or null",
  "clientEmail": "Email if found or null",
  "address": "Address if found or null",
  "description": "Clear job description extracted from the message",
  "suggestedTitle": "Short title for the job (max 40 chars)",
  "urgency": "urgent|normal|flexible",
  "extractedDetails": ["List of", "key details", "found in message"]
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Parse this message for a ${tradeType} job:\n\n"${text}"` }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(responseText);

    return {
      success: true,
      clientName: parsed.clientName || undefined,
      clientPhone: parsed.clientPhone || undefined,
      clientEmail: parsed.clientEmail || undefined,
      address: parsed.address || undefined,
      description: parsed.description || text.substring(0, 200),
      suggestedTitle: parsed.suggestedTitle || 'New Job',
      urgency: parsed.urgency || 'normal',
      extractedDetails: parsed.extractedDetails || []
    };
  } catch (error) {
    console.error('Text parsing error:', error);
    // Fallback: basic extraction
    const phoneMatch = text.match(/\b0[45]\d{2}[\s-]?\d{3}[\s-]?\d{3}\b/);
    const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
    
    return {
      success: true,
      clientPhone: phoneMatch?.[0],
      clientEmail: emailMatch?.[0],
      description: text.substring(0, 300),
      suggestedTitle: 'New Job Enquiry',
      urgency: text.toLowerCase().includes('urgent') || text.toLowerCase().includes('asap') ? 'urgent' : 'normal',
      extractedDetails: []
    };
  }
}

/**
 * Detect if an SMS message is a job/quote request from a client
 * Used to trigger "Create Job from SMS" action
 */
export async function detectSmsJobIntent(
  messageBody: string,
  clientName?: string,
  hasMedia?: boolean
): Promise<{
  isJobRequest: boolean;
  confidence: 'high' | 'medium' | 'low';
  suggestedJobTitle?: string;
  suggestedDescription?: string;
  urgency: 'urgent' | 'normal' | 'flexible';
  intentType: 'quote_request' | 'job_request' | 'enquiry' | 'followup' | 'other';
}> {
  const systemPrompt = `You are an Australian trades business SMS analyzer. Analyze incoming SMS/text messages to detect if a client is requesting a job, quote, or service.

Common indicators of job/quote requests:
- Asking for quotes ("how much for...", "can you quote...", "what would it cost...")
- Describing problems ("my tap is leaking", "power went out", "need aircon serviced")
- Requesting service ("can you come...", "need help with...", "looking for someone to...")
- Scheduling requests ("when are you available", "can you come this week")
- Urgent language ("ASAP", "urgent", "emergency")

NOT job requests:
- Simple replies ("thanks", "ok", "sounds good")
- Confirmations ("yes that works", "confirmed")
- Questions about existing work ("is my job done?")
- Payment/invoice queries

Return JSON:
{
  "isJobRequest": boolean,
  "confidence": "high" | "medium" | "low",
  "suggestedJobTitle": "short title if job request, null otherwise",
  "suggestedDescription": "brief description of what they need, null if not job request",
  "urgency": "urgent" | "normal" | "flexible",
  "intentType": "quote_request" | "job_request" | "enquiry" | "followup" | "other"
}`;

  try {
    const context = hasMedia ? '(Message includes photo/image attachments)' : '';
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Analyze this SMS from ${clientName || 'a client'}: "${messageBody}" ${context}` }
      ],
      temperature: 0.2,
      max_tokens: 300,
      response_format: { type: "json_object" }
    });

    const responseText = completion.choices[0]?.message?.content || '';
    const parsed = JSON.parse(responseText);

    return {
      isJobRequest: parsed.isJobRequest === true,
      confidence: parsed.confidence || 'low',
      suggestedJobTitle: parsed.suggestedJobTitle || undefined,
      suggestedDescription: parsed.suggestedDescription || undefined,
      urgency: parsed.urgency || 'normal',
      intentType: parsed.intentType || 'other'
    };
  } catch (error) {
    console.error('[AI] SMS intent detection error (using fallback keyword detection):', error);
    // Fallback: simple keyword detection when AI is unavailable
    const lowerBody = messageBody.toLowerCase();
    const strongKeywords = ['quote', 'how much', 'can you fix', 'repair', 'broken', 'leaking', 'urgent', 'asap', 'emergency'];
    const weakKeywords = ['need', 'help', 'service', 'can you', 'install'];
    
    const hasStrongIndicator = strongKeywords.some(kw => lowerBody.includes(kw));
    const hasWeakIndicator = weakKeywords.some(kw => lowerBody.includes(kw));
    const hasJobIndicator = hasStrongIndicator || hasWeakIndicator;
    
    // Assign medium confidence when strong keywords found, low for weak keywords
    const confidence = hasStrongIndicator ? 'medium' : (hasWeakIndicator ? 'low' : 'low');
    
    return {
      isJobRequest: hasJobIndicator,
      confidence: confidence as 'high' | 'medium' | 'low',
      suggestedJobTitle: hasJobIndicator ? 'New Enquiry from SMS' : undefined,
      suggestedDescription: hasJobIndicator ? messageBody : undefined,
      urgency: lowerBody.includes('urgent') || lowerBody.includes('asap') || lowerBody.includes('emergency') ? 'urgent' : 'normal',
      intentType: hasStrongIndicator ? 'quote_request' : (hasWeakIndicator ? 'enquiry' : 'other')
    };
  }
}

/**
 * Streaming photo analysis for job photos
 * Uses GPT-4o vision to analyze photos and generate notes with references
 */
export async function* streamPhotoAnalysis(
  photos: Array<{ id: string; signedUrl: string; fileName: string; category?: string; caption?: string }>,
  jobContext: { title: string; description?: string; clientName?: string; trade?: string }
): AsyncGenerator<string, void, unknown> {
  if (!photos.length) {
    yield "No photos to analyse.";
    return;
  }

  const imageContents: Array<{ type: "image_url"; image_url: { url: string; detail: "low" | "high" | "auto" } }> = [];
  
  for (const photo of photos) {
    imageContents.push({
      type: "image_url",
      image_url: {
        url: photo.signedUrl,
        detail: "low" // Use low detail for faster processing and lower cost
      }
    });
  }

  const photoLabels = photos.map((p, i) => `Photo ${i + 1}: ${p.fileName}${p.category ? ` (${p.category})` : ''}${p.caption ? ` - ${p.caption}` : ''}`).join('\n');

  const systemPrompt = `You are a trades assistant helping document job photos for an Australian tradesperson.

Job Context:
- Title: ${jobContext.title}
- Description: ${jobContext.description || 'Not provided'}
- Client: ${jobContext.clientName || 'Not specified'}
- Trade: ${jobContext.trade || 'General trades'}

Photo Labels:
${photoLabels}

Analyse each photo and provide clear, professional notes that a tradie would find useful. For each photo:
1. Describe what you see (equipment, damage, work area, materials, etc.)
2. Note any issues or observations relevant to the job
3. Use Australian English spelling (e.g., colour, metre, centre)

Format your response as notes with photo references like:
"(Photo 1) Shows the corroded pipe section under the sink..."
"(Photo 2) The damaged electrical outlet with visible scorch marks..."

Keep descriptions practical and focused on what matters for the job documentation. Be concise but thorough.`;

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: [
            { type: "text", text: "Please analyse these job photos and provide notes for each one:" },
            ...imageContents
          ]
        }
      ],
      max_tokens: 1500,
      stream: true
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  } catch (error: any) {
    console.error('[AI] Photo analysis streaming error:', error);
    yield `\n\n[Error analysing photos: ${error.message}]`;
  }
}

/**
 * Calculate job profitability with simple indicators
 */
export function calculateJobProfit(params: {
  invoiceTotal: number;
  labourCost: number;
  materialsCost: number;
  otherExpenses: number;
}): { profit: number; margin: number; status: 'profitable' | 'break_even' | 'loss' } {
  const { invoiceTotal, labourCost, materialsCost, otherExpenses } = params;
  const totalCosts = labourCost + materialsCost + otherExpenses;
  const profit = invoiceTotal - totalCosts;
  const margin = invoiceTotal > 0 ? (profit / invoiceTotal) * 100 : 0;

  let status: 'profitable' | 'break_even' | 'loss' = 'profitable';
  if (margin < 5) status = 'break_even';
  if (profit < 0) status = 'loss';

  return { profit, margin, status };
}

// Haversine formula to calculate distance between two coordinates
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

interface ScheduleJob {
  id: string;
  title: string;
  clientName: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  estimatedDuration?: number; // in hours
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  preferredTimeSlot?: 'morning' | 'afternoon' | 'any';
}

interface OptimizedSchedule {
  optimizedOrder: Array<{
    job: ScheduleJob;
    suggestedTime: string;
    travelDistance?: number;
    reason: string;
  }>;
  totalDistance: number;
  totalTime: number;
  aiSuggestions: string[];
}

/**
 * AI-powered schedule optimization using location and time constraints
 * Uses nearest-neighbor algorithm with AI enhancement for suggestions
 */
export async function optimizeSchedule(
  jobs: ScheduleJob[],
  startLocation?: { latitude: number; longitude: number },
  workdayStart: string = '07:00',
  workdayEnd: string = '17:00'
): Promise<OptimizedSchedule> {
  if (jobs.length === 0) {
    return {
      optimizedOrder: [],
      totalDistance: 0,
      totalTime: 0,
      aiSuggestions: ['No jobs to schedule.']
    };
  }

  // Filter jobs with valid coordinates
  const jobsWithCoords = jobs.filter(j => j.latitude && j.longitude);
  const jobsWithoutCoords = jobs.filter(j => !j.latitude || !j.longitude);

  // Sort jobs by priority first
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedByPriority = [...jobsWithCoords].sort((a, b) => 
    (priorityOrder[a.priority || 'medium'] || 2) - (priorityOrder[b.priority || 'medium'] || 2)
  );

  // Use nearest-neighbor algorithm for route optimization
  const optimizedRoute: typeof sortedByPriority = [];
  const remaining = [...sortedByPriority];
  let currentLat = startLocation?.latitude || remaining[0]?.latitude || 0;
  let currentLon = startLocation?.longitude || remaining[0]?.longitude || 0;
  let totalDistance = 0;

  while (remaining.length > 0) {
    let nearestIndex = 0;
    let nearestDistance = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const job = remaining[i];
      if (job.latitude && job.longitude) {
        const dist = haversineDistance(currentLat, currentLon, job.latitude, job.longitude);
        // Adjust distance by priority (urgent jobs get bonus proximity)
        const priorityBonus = job.priority === 'urgent' ? 0.5 : job.priority === 'high' ? 0.7 : 1;
        const adjustedDist = dist * priorityBonus;
        if (adjustedDist < nearestDistance) {
          nearestDistance = adjustedDist;
          nearestIndex = i;
        }
      }
    }

    const nextJob = remaining.splice(nearestIndex, 1)[0];
    if (nextJob.latitude && nextJob.longitude) {
      totalDistance += haversineDistance(currentLat, currentLon, nextJob.latitude, nextJob.longitude);
      currentLat = nextJob.latitude;
      currentLon = nextJob.longitude;
    }
    optimizedRoute.push(nextJob);
  }

  // Calculate suggested times
  const parseTime = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };
  const formatTime = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  let currentTime = parseTime(workdayStart);
  const endTime = parseTime(workdayEnd);
  let totalWorkTime = 0;

  const optimizedOrder = optimizedRoute.map((job, index) => {
    const duration = (job.estimatedDuration || 1.5) * 60; // Default 1.5 hours
    const travelTime = index > 0 ? 15 : 0; // 15 min travel between jobs
    
    currentTime += travelTime;
    const suggestedTime = formatTime(currentTime);
    currentTime += duration;
    totalWorkTime += duration + travelTime;

    const prevJob = index > 0 ? optimizedRoute[index - 1] : null;
    const travelDistance = prevJob && prevJob.latitude && prevJob.longitude && job.latitude && job.longitude
      ? haversineDistance(prevJob.latitude, prevJob.longitude, job.latitude, job.longitude)
      : undefined;

    let reason = '';
    if (job.priority === 'urgent') {
      reason = 'Prioritised due to urgent status';
    } else if (travelDistance && travelDistance < 5) {
      reason = `Close to previous job (${travelDistance.toFixed(1)}km)`;
    } else if (index === 0) {
      reason = 'First stop of the day';
    } else {
      reason = 'Optimal route position';
    }

    return { job, suggestedTime, travelDistance, reason };
  });

  // Add jobs without coordinates at the end
  for (const job of jobsWithoutCoords) {
    const duration = (job.estimatedDuration || 1.5) * 60;
    currentTime += 15; // Travel time
    const suggestedTime = formatTime(Math.min(currentTime, endTime - duration));
    currentTime += duration;
    totalWorkTime += duration + 15;
    
    optimizedOrder.push({
      job,
      suggestedTime,
      reason: 'Location not available - scheduled at end'
    });
  }

  // Generate AI suggestions
  const aiSuggestions: string[] = [];
  
  if (totalDistance > 50) {
    aiSuggestions.push(`Long travel day (${totalDistance.toFixed(1)}km) - consider grouping jobs by area in future.`);
  }
  
  if (currentTime > endTime) {
    const overtime = Math.round((currentTime - endTime) / 60 * 10) / 10;
    aiSuggestions.push(`Schedule runs ${overtime} hours over. Consider moving low-priority jobs to another day.`);
  }
  
  if (jobsWithoutCoords.length > 0) {
    aiSuggestions.push(`${jobsWithoutCoords.length} job(s) missing address coordinates - add addresses for better optimisation.`);
  }

  const urgentJobs = jobs.filter(j => j.priority === 'urgent').length;
  if (urgentJobs > 2) {
    aiSuggestions.push(`${urgentJobs} urgent jobs today - consider delegating some if possible.`);
  }

  if (aiSuggestions.length === 0) {
    aiSuggestions.push('Schedule looks well-optimised! Minimal travel between jobs.');
  }

  return {
    optimizedOrder,
    totalDistance: Math.round(totalDistance * 10) / 10,
    totalTime: Math.round(totalWorkTime / 60 * 10) / 10,
    aiSuggestions
  };
}

/**
 * Get AI-powered scheduling recommendations for a specific date
 */
export async function getSchedulingRecommendations(
  jobs: ScheduleJob[],
  businessContext: { trade?: string; businessName?: string }
): Promise<string> {
  const jobSummary = jobs.map((j, i) => 
    `${i + 1}. ${j.title} - ${j.clientName}${j.address ? ` (${j.address})` : ''}${j.priority ? ` [${j.priority}]` : ''}`
  ).join('\n');

  const prompt = `You are an AI scheduling assistant for ${businessContext.businessName || 'a trades business'} (${businessContext.trade || 'general trades'}).

Here are the jobs to schedule for today:
${jobSummary}

Provide 2-3 brief, actionable scheduling tips in Australian English. Consider:
- Job priorities and urgency
- Geographic clustering
- Time efficiency
- Client expectations

Keep each tip to 1-2 sentences.`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful scheduling assistant for Australian tradespeople. Be concise and practical." },
        { role: "user", content: prompt }
      ],
      max_tokens: 300,
      temperature: 0.7
    });

    return response.choices[0]?.message?.content || 'Unable to generate recommendations.';
  } catch (error: any) {
    console.error('[AI] Scheduling recommendations error:', error);
    return 'Unable to generate recommendations at this time.';
  }
}
