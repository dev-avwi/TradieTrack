// Trade types with colors and characteristics - production configuration
export const tradeTypes = {
  plumbing: {
    name: "Plumbing",
    color: "#2563eb",
    description: "Pipes, taps, drains, and water systems",
    typicalJobs: ["Leak repairs", "Tap installation", "Drain clearing", "Hot water systems"]
  },
  electrical: {
    name: "Electrical", 
    color: "#dc2626",
    description: "Wiring, lighting, and electrical systems",
    typicalJobs: ["Power points", "Light installation", "Switchboard upgrades", "Safety switches"]
  },
  carpentry: {
    name: "Carpentry",
    color: "#ea580c", 
    description: "Timber work, construction, and joinery",
    typicalJobs: ["Decks", "Cabinets", "Door hanging", "Pergolas"]
  },
  hvac: {
    name: "Air Conditioning & Heating",
    color: "#0ea5e9",
    description: "Climate control systems",
    typicalJobs: ["AC installation", "System servicing", "Duct cleaning", "Repairs"]
  },
  painting: {
    name: "Painting",
    color: "#7c3aed",
    description: "Interior and exterior painting",
    typicalJobs: ["House painting", "Fence painting", "Prep work", "Color consulting"]
  },
  landscaping: {
    name: "Landscaping",
    color: "#16a34a",
    description: "Garden design and maintenance",
    typicalJobs: ["Lawn installation", "Garden beds", "Tree removal", "Irrigation"]
  },
  roofing: {
    name: "Roofing",
    color: "#78350f",
    description: "Roof installation, repairs and maintenance",
    typicalJobs: ["Roof repairs", "Gutter installation", "Tile replacement", "Roof restoration"]
  },
  tiling: {
    name: "Tiling",
    color: "#0891b2",
    description: "Floor and wall tiling",
    typicalJobs: ["Bathroom tiling", "Kitchen splashbacks", "Floor tiling", "Grout repairs"]
  },
  concreting: {
    name: "Concreting",
    color: "#64748b",
    description: "Concrete work and foundations",
    typicalJobs: ["Driveways", "Paths", "Slabs", "Retaining walls"]
  },
  cleaning: {
    name: "Cleaning Services",
    color: "#06b6d4",
    description: "Professional cleaning services",
    typicalJobs: ["End of lease", "Carpet cleaning", "Window cleaning", "Regular cleaning"]
  },
  other: {
    name: "Other Trade Services",
    color: "#6b7280",
    description: "General contracting and trade services",
    typicalJobs: ["Custom services", "Maintenance", "Repairs", "Consultation"]
  }
};

export type TradeType = keyof typeof tradeTypes;

// Get trade-specific content
export const getTradeInfo = (tradeType: string) => {
  return tradeTypes[tradeType as TradeType] || tradeTypes.other;
};

// Get all trade types as options for select components
export const getTradeOptions = () => {
  return Object.entries(tradeTypes).map(([value, info]) => ({
    value,
    label: info.name
  }));
};
