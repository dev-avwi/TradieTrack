// Centralized mock data for consistent testing across the app
export interface MockClient {
  id: string;
  name: string;
  email?: string;
  phone: string;
  address: string;
  jobsCount: number;
  lastJobDate: string;
  tradePreference?: string; // Preferred trade type
}

export interface MockJob {
  id: string;
  clientId: string;
  title: string;
  description: string;
  client: string;
  address: string;
  scheduledAt: string;
  status: 'pending' | 'in_progress' | 'done';
  assignedTo?: string;
  hasPhotos?: boolean;
  tradeType: string;
  estimatedValue?: number;
}

export interface MockQuote {
  id: string;
  jobId?: string;
  clientId: string;
  number: string;
  client: string;
  jobTitle: string;
  total: number;
  status: 'draft' | 'sent' | 'accepted' | 'rejected';
  validUntil?: string;
  sentAt?: string;
  tradeType: string;
}

export interface MockInvoice {
  id: string;
  quoteId?: string;
  clientId: string;
  number: string;
  client: string;
  jobTitle: string;
  total: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  sentAt?: string;
  paidAt?: string;
  dueDate?: string;
  tradeType: string;
}

// Consistent client data across the app
export const mockClients: MockClient[] = [
  {
    id: "client-001",
    name: "Sarah Johnson",
    email: "sarah.johnson@email.com",
    phone: "(07) 4123 4567",
    address: "15 Oak Street, Cairns QLD 4870",
    jobsCount: 3,
    lastJobDate: "2 days ago",
    tradePreference: "plumbing"
  },
  {
    id: "client-002", 
    name: "David Wilson",
    email: "d.wilson@email.com",
    phone: "(07) 4987 6543",
    address: "8 Pine Avenue, Trinity Beach QLD 4879",
    jobsCount: 2,
    lastJobDate: "1 week ago",
    tradePreference: "electrical"
  },
  {
    id: "client-003",
    name: "Emma Thompson",
    email: "emma.thompson@email.com",
    phone: "(07) 4555 7890",
    address: "22 Beach Road, Palm Cove QLD 4879",
    jobsCount: 2,
    lastJobDate: "3 weeks ago",
    tradePreference: "carpentry"
  },
  {
    id: "client-004",
    name: "Mark Stevens",
    email: "mark.stevens@email.com",
    phone: "(07) 4321 9876",
    address: "45 Main Street, Cairns QLD 4870",
    jobsCount: 1,
    lastJobDate: "1 month ago",
    tradePreference: "hvac"
  },
  {
    id: "client-005",
    name: "Lisa Chen",
    email: "lisa.chen@email.com",
    phone: "(07) 4444 5555",
    address: "67 Coral Drive, Port Douglas QLD 4877",
    jobsCount: 1,
    lastJobDate: "2 weeks ago",
    tradePreference: "painting"
  }
];

// Consistent job data that references the clients above
export const mockJobs: MockJob[] = [
  {
    id: "job-001",
    clientId: "client-001",
    title: "Kitchen Renovation - Plumbing Work",
    description: "Install new kitchen sink, dishwasher connections, and fix leaking tap",
    client: "Sarah Johnson",
    address: "15 Oak Street, Cairns QLD 4870",
    scheduledAt: "Today, 2:00 PM",
    status: "pending",
    assignedTo: "Mike",
    hasPhotos: true,
    tradeType: "plumbing",
    estimatedValue: 2850
  },
  {
    id: "job-002",
    clientId: "client-002",
    title: "Bathroom Electrical Upgrade",
    description: "Install new exhaust fan, additional power points, and LED downlights",
    client: "David Wilson",
    address: "8 Pine Avenue, Trinity Beach QLD 4879",
    scheduledAt: "Tomorrow, 9:00 AM",
    status: "in_progress",
    tradeType: "electrical",
    estimatedValue: 1450
  },
  {
    id: "job-003",
    clientId: "client-003",
    title: "Deck Construction",
    description: "Build 4x6m timber deck with balustrade and stairs",
    client: "Emma Thompson",
    address: "22 Beach Road, Palm Cove QLD 4879",
    scheduledAt: "Next Monday, 8:00 AM",
    status: "pending",
    hasPhotos: false,
    tradeType: "carpentry",
    estimatedValue: 6800
  },
  {
    id: "job-004",
    clientId: "client-004",
    title: "Air Conditioning Service",
    description: "Annual service of ducted AC system, clean filters, check refrigerant",
    client: "Mark Stevens",
    address: "45 Main Street, Cairns QLD 4870",
    scheduledAt: "Yesterday, 10:30 AM",
    status: "done",
    hasPhotos: true,
    tradeType: "hvac",
    estimatedValue: 380
  },
  {
    id: "job-005",
    clientId: "client-005",
    title: "House Exterior Painting",
    description: "Prep and paint exterior walls, windows, and front door",
    client: "Lisa Chen",
    address: "67 Coral Drive, Port Douglas QLD 4877",
    scheduledAt: "Next Wednesday, 7:00 AM",
    status: "pending",
    tradeType: "painting",
    estimatedValue: 4200
  }
];

// Quotes that link to the jobs above
export const mockQuotes: MockQuote[] = [
  {
    id: "quote-001",
    jobId: "job-001",
    clientId: "client-001",
    number: "QT-2025-001",
    client: "Sarah Johnson",
    jobTitle: "Kitchen Renovation - Plumbing Work",
    total: 2850.00,
    status: "draft",
    validUntil: "Jan 15, 2025",
    tradeType: "plumbing"
  },
  {
    id: "quote-002",
    jobId: "job-002",
    clientId: "client-002",
    number: "QT-2025-002",
    client: "David Wilson",
    jobTitle: "Bathroom Electrical Upgrade",
    total: 1450.00,
    status: "sent",
    validUntil: "Jan 20, 2025",
    sentAt: "3 days ago",
    tradeType: "electrical"
  },
  {
    id: "quote-003",
    jobId: "job-003",
    clientId: "client-003",
    number: "QT-2025-003",
    client: "Emma Thompson",
    jobTitle: "Deck Construction",
    total: 6800.00,
    status: "accepted",
    sentAt: "1 week ago",
    tradeType: "carpentry"
  },
  {
    id: "quote-004",
    jobId: "job-005",
    clientId: "client-005",
    number: "QT-2025-004",
    client: "Lisa Chen",
    jobTitle: "House Exterior Painting",
    total: 4200.00,
    status: "sent",
    validUntil: "Feb 1, 2025",
    sentAt: "2 days ago",
    tradeType: "painting"
  }
];

// Invoices that link to quotes/jobs above
export const mockInvoices: MockInvoice[] = [
  {
    id: "invoice-001",
    quoteId: "quote-003",
    clientId: "client-003",
    number: "TT-2025-001",
    client: "Emma Thompson",
    jobTitle: "Deck Construction",
    total: 6800.00,
    status: "sent",
    sentAt: "3 days ago",
    dueDate: "Jan 25, 2025",
    tradeType: "carpentry"
  },
  {
    id: "invoice-002",
    clientId: "client-004",
    number: "TT-2025-002",
    client: "Mark Stevens",
    jobTitle: "Air Conditioning Service",
    total: 380.00,
    status: "paid",
    sentAt: "1 week ago",
    paidAt: "5 days ago",
    tradeType: "hvac"
  },
  {
    id: "invoice-003",
    clientId: "client-001",
    number: "TT-2025-003",
    client: "Sarah Johnson",
    jobTitle: "Emergency Pipe Repair",
    total: 890.00,
    status: "overdue",
    sentAt: "2 weeks ago",
    dueDate: "Jan 10, 2025",
    tradeType: "plumbing"
  }
];

// Trade types with colors and characteristics
export const tradeTypes = {
  plumbing: {
    name: "Plumbing",
    color: "#2563eb",
    icon: "🔧",
    description: "Pipes, taps, drains, and water systems",
    typicalJobs: ["Leak repairs", "Tap installation", "Drain clearing", "Hot water systems"]
  },
  electrical: {
    name: "Electrical", 
    color: "#dc2626",
    icon: "⚡",
    description: "Wiring, lighting, and electrical systems",
    typicalJobs: ["Power points", "Light installation", "Switchboard upgrades", "Safety switches"]
  },
  carpentry: {
    name: "Carpentry",
    color: "#ea580c", 
    icon: "🔨",
    description: "Timber work, construction, and joinery",
    typicalJobs: ["Decks", "Cabinets", "Door hanging", "Pergolas"]
  },
  hvac: {
    name: "Air Conditioning & Heating",
    color: "#0ea5e9",
    icon: "❄️",
    description: "Climate control systems",
    typicalJobs: ["AC installation", "System servicing", "Duct cleaning", "Repairs"]
  },
  painting: {
    name: "Painting",
    color: "#7c3aed",
    icon: "🎨", 
    description: "Interior and exterior painting",
    typicalJobs: ["House painting", "Fence painting", "Prep work", "Color consulting"]
  },
  landscaping: {
    name: "Landscaping",
    color: "#16a34a",
    icon: "🌱",
    description: "Garden design and maintenance",
    typicalJobs: ["Lawn installation", "Garden beds", "Tree removal", "Irrigation"]
  },
  other: {
    name: "Other Trade Services",
    color: "#6b7280",
    icon: "🛠️",
    description: "General contracting and trade services",
    typicalJobs: ["Custom services", "Maintenance", "Repairs", "Consultation"]
  }
};

// Get trade-specific content
export const getTradeInfo = (tradeType: string) => {
  return tradeTypes[tradeType as keyof typeof tradeTypes] || tradeTypes.plumbing;
};

// Get mock data filtered by trade type
export const getJobsByTrade = (tradeType?: string) => {
  if (!tradeType) return mockJobs;
  return mockJobs.filter(job => job.tradeType === tradeType);
};

export const getQuotesByTrade = (tradeType?: string) => {
  if (!tradeType) return mockQuotes;
  return mockQuotes.filter(quote => quote.tradeType === tradeType);
};

export const getInvoicesByTrade = (tradeType?: string) => {
  if (!tradeType) return mockInvoices;
  return mockInvoices.filter(invoice => invoice.tradeType === tradeType);
};

export const getClientsByTrade = (tradeType?: string) => {
  if (!tradeType) return mockClients;
  return mockClients.filter(client => client.tradePreference === tradeType);
};