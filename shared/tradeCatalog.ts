/**
 * Centralized Trade Catalog for TradieTrack
 * Each trade has comprehensive configuration for a tailored app experience
 */

export interface TradeTerminology {
  job: string;
  jobs: string;
  client: string;
  clients: string;
  quote: string;
  quotes: string;
  worksite: string;
  worksites: string;
}

export interface TradeJobStage {
  id: string;
  name: string;
  description: string;
  color: string;
}

export interface TradeCustomField {
  id: string;
  name: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  options?: string[];
  required?: boolean;
  placeholder?: string;
  unit?: string;
}

export interface TradeMaterial {
  name: string;
  unit: string;
  defaultPrice: number;
  category: string;
}

export interface TradeRateCard {
  hourlyRate: number;
  calloutFee: number;
  afterHoursMultiplier: number;
  weekendMultiplier: number;
  materialMarkupPct: number;
}

export interface TradeSafetyChecklist {
  name: string;
  items: string[];
}

export interface TradeDefinition {
  id: string;
  name: string;
  shortName: string;
  icon: string;
  color: string;
  description: string;
  typicalJobs: string[];
  terminology: TradeTerminology;
  jobStages: TradeJobStage[];
  customFields: TradeCustomField[];
  defaultMaterials: TradeMaterial[];
  defaultRateCard: TradeRateCard;
  safetyChecklists: TradeSafetyChecklist[];
  quoteCategories: string[];
  invoicePaymentTerms: number;
  licenseRequired?: string;
}

const defaultTerminology: TradeTerminology = {
  job: 'Job',
  jobs: 'Jobs',
  client: 'Client',
  clients: 'Clients',
  quote: 'Quote',
  quotes: 'Quotes',
  worksite: 'Site',
  worksites: 'Sites',
};

const defaultJobStages: TradeJobStage[] = [
  { id: 'pending', name: 'Pending', description: 'Awaiting confirmation', color: '#6b7280' },
  { id: 'scheduled', name: 'Scheduled', description: 'Booked in calendar', color: '#3b82f6' },
  { id: 'in_progress', name: 'In Progress', description: 'Work underway', color: '#f59e0b' },
  { id: 'done', name: 'Done', description: 'Work completed', color: '#22c55e' },
  { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
];

export const tradeCatalog: Record<string, TradeDefinition> = {
  electrical: {
    id: 'electrical',
    name: 'Electrical',
    shortName: 'Sparky',
    icon: 'Zap',
    color: '#dc2626',
    description: 'Wiring, lighting, and electrical systems',
    typicalJobs: ['Power points', 'Light installation', 'Switchboard upgrades', 'Safety switches', 'Ceiling fans', 'Smoke alarms'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'circuitType', name: 'Circuit Type', type: 'select', options: ['Single Phase', 'Three Phase', 'Low Voltage'] },
      { id: 'amperage', name: 'Amperage', type: 'number', unit: 'A' },
      { id: 'rcdTested', name: 'RCD Tested', type: 'checkbox' },
      { id: 'cocRequired', name: 'Certificate of Compliance Required', type: 'checkbox' },
      { id: 'meterNumber', name: 'Meter Number', type: 'text' },
    ],
    defaultMaterials: [
      { name: 'Power Point (Double GPO)', unit: 'each', defaultPrice: 35, category: 'Outlets' },
      { name: 'LED Downlight', unit: 'each', defaultPrice: 45, category: 'Lighting' },
      { name: 'Safety Switch (RCD)', unit: 'each', defaultPrice: 85, category: 'Switchboard' },
      { name: 'Smoke Alarm (240V)', unit: 'each', defaultPrice: 65, category: 'Safety' },
      { name: 'Ceiling Fan', unit: 'each', defaultPrice: 180, category: 'Appliances' },
      { name: 'Cable (2.5mm TPS)', unit: 'm', defaultPrice: 4.50, category: 'Cable' },
      { name: 'Cable (4mm TPS)', unit: 'm', defaultPrice: 6.50, category: 'Cable' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 85,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Electrical Safety Checklist',
        items: [
          'Isolate power at switchboard',
          'Test for dead with voltage tester',
          'Lock out/tag out procedures followed',
          'PPE worn (insulated gloves, safety glasses)',
          'Fire extinguisher accessible',
          'Work area clear of hazards',
        ],
      },
    ],
    quoteCategories: ['Outlets & Switches', 'Lighting', 'Switchboard', 'Safety Devices', 'Appliance Installation', 'Rewiring'],
    invoicePaymentTerms: 14,
    licenseRequired: 'Electrical Contractor License',
  },

  plumbing: {
    id: 'plumbing',
    name: 'Plumbing',
    shortName: 'Plumber',
    icon: 'Droplets',
    color: '#2563eb',
    description: 'Pipes, taps, drains, and water systems',
    typicalJobs: ['Leak repairs', 'Tap installation', 'Drain clearing', 'Hot water systems', 'Toilet repairs', 'Gas fitting'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'pipeSize', name: 'Pipe Size', type: 'select', options: ['15mm', '20mm', '25mm', '32mm', '40mm', '50mm', '65mm', '80mm', '100mm'] },
      { id: 'pipeMaterial', name: 'Pipe Material', type: 'select', options: ['Copper', 'PVC', 'PEX', 'Galvanised', 'HDPE', 'Cast Iron'] },
      { id: 'waterPressure', name: 'Water Pressure', type: 'number', unit: 'kPa' },
      { id: 'hotWaterType', name: 'Hot Water Type', type: 'select', options: ['Electric', 'Gas', 'Solar', 'Heat Pump'] },
      { id: 'gasWork', name: 'Gas Work Involved', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Mixer Tap (Basin)', unit: 'each', defaultPrice: 120, category: 'Tapware' },
      { name: 'Mixer Tap (Kitchen)', unit: 'each', defaultPrice: 180, category: 'Tapware' },
      { name: 'Toilet Suite', unit: 'each', defaultPrice: 350, category: 'Fixtures' },
      { name: 'Basin', unit: 'each', defaultPrice: 150, category: 'Fixtures' },
      { name: 'Copper Pipe 15mm', unit: 'm', defaultPrice: 18, category: 'Pipes' },
      { name: 'PVC Pipe 50mm', unit: 'm', defaultPrice: 12, category: 'Pipes' },
      { name: 'Flexi Hose', unit: 'each', defaultPrice: 25, category: 'Fittings' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 90,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Plumbing Safety Checklist',
        items: [
          'Water supply isolated',
          'Gas supply isolated (if applicable)',
          'Hot water system isolated',
          'PPE worn (gloves, safety glasses)',
          'Drain camera inspection completed',
          'Asbestos check for older properties',
        ],
      },
    ],
    quoteCategories: ['Tapware', 'Fixtures', 'Pipes & Fittings', 'Hot Water', 'Drainage', 'Gas Fitting'],
    invoicePaymentTerms: 14,
    licenseRequired: 'Plumbing License',
  },

  building: {
    id: 'building',
    name: 'Building & Construction',
    shortName: 'Builder',
    icon: 'Hammer',
    color: '#ea580c',
    description: 'Construction, renovations, and building work',
    typicalJobs: ['Renovations', 'Extensions', 'Decks', 'Pergolas', 'Granny flats', 'Kitchen fit-outs'],
    terminology: {
      job: 'Project',
      jobs: 'Projects',
      client: 'Client',
      clients: 'Clients',
      quote: 'Estimate',
      quotes: 'Estimates',
      worksite: 'Site',
      worksites: 'Sites',
    },
    jobStages: [
      { id: 'pending', name: 'Quote Stage', description: 'Preparing estimate', color: '#6b7280' },
      { id: 'scheduled', name: 'Approved', description: 'Project approved', color: '#3b82f6' },
      { id: 'in_progress', name: 'Construction', description: 'Building underway', color: '#f59e0b' },
      { id: 'done', name: 'Practical Completion', description: 'Handover ready', color: '#22c55e' },
      { id: 'invoiced', name: 'Final Invoice', description: 'Final payment', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'projectType', name: 'Project Type', type: 'select', options: ['New Build', 'Renovation', 'Extension', 'Fit-out', 'Maintenance'] },
      { id: 'approvalRequired', name: 'Council Approval Required', type: 'checkbox' },
      { id: 'permitNumber', name: 'Building Permit Number', type: 'text' },
      { id: 'contractValue', name: 'Contract Value', type: 'number', unit: '$' },
      { id: 'retentionPct', name: 'Retention %', type: 'number', unit: '%' },
    ],
    defaultMaterials: [
      { name: 'Timber Framing (90x45)', unit: 'm', defaultPrice: 8.50, category: 'Timber' },
      { name: 'Timber Framing (140x45)', unit: 'm', defaultPrice: 12.50, category: 'Timber' },
      { name: 'Merbau Decking', unit: 'm²', defaultPrice: 85, category: 'Decking' },
      { name: 'Treated Pine Decking', unit: 'm²', defaultPrice: 45, category: 'Decking' },
      { name: 'Concrete (25MPa)', unit: 'm³', defaultPrice: 250, category: 'Concrete' },
      { name: 'Roofing (Colorbond)', unit: 'm²', defaultPrice: 35, category: 'Roofing' },
    ],
    defaultRateCard: {
      hourlyRate: 85,
      calloutFee: 0,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Construction Site Safety',
        items: [
          'Site induction completed',
          'SWMS reviewed and signed',
          'Hard hat and hi-vis worn',
          'Fall protection in place (if working at heights)',
          'First aid kit accessible',
          'Emergency exits clear',
          'Power tools inspected and tagged',
        ],
      },
    ],
    quoteCategories: ['Demolition', 'Framing', 'Roofing', 'Cladding', 'Fit-out', 'Finishing'],
    invoicePaymentTerms: 30,
    licenseRequired: 'Builder License (QBCC)',
  },

  landscaping: {
    id: 'landscaping',
    name: 'Landscaping & Gardening',
    shortName: 'Landscaper',
    icon: 'Trees',
    color: '#16a34a',
    description: 'Garden design, maintenance, and outdoor spaces',
    typicalJobs: ['Lawn installation', 'Garden beds', 'Tree removal', 'Irrigation', 'Retaining walls', 'Paving'],
    terminology: {
      job: 'Project',
      jobs: 'Projects',
      client: 'Client',
      clients: 'Clients',
      quote: 'Quote',
      quotes: 'Quotes',
      worksite: 'Property',
      worksites: 'Properties',
    },
    jobStages: [
      { id: 'pending', name: 'Design Phase', description: 'Planning and design', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Booked in', color: '#3b82f6' },
      { id: 'in_progress', name: 'Installation', description: 'Work in progress', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Planting/installation done', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'propertySize', name: 'Property Size', type: 'number', unit: 'm²' },
      { id: 'soilType', name: 'Soil Type', type: 'select', options: ['Clay', 'Sandy', 'Loam', 'Rocky', 'Mixed'] },
      { id: 'irrigationType', name: 'Irrigation Type', type: 'select', options: ['None', 'Manual', 'Drip', 'Sprinkler', 'Smart System'] },
      { id: 'greenWasteDisposal', name: 'Green Waste Disposal Required', type: 'checkbox' },
      { id: 'accessType', name: 'Site Access', type: 'select', options: ['Easy (vehicle)', 'Limited', 'Difficult (manual only)'] },
    ],
    defaultMaterials: [
      { name: 'Turf (Sir Walter)', unit: 'm²', defaultPrice: 16, category: 'Lawn' },
      { name: 'Turf (Couch)', unit: 'm²', defaultPrice: 12, category: 'Lawn' },
      { name: 'Mulch (Hardwood)', unit: 'm³', defaultPrice: 85, category: 'Mulch' },
      { name: 'Garden Soil', unit: 'm³', defaultPrice: 95, category: 'Soil' },
      { name: 'Sleepers (Treated Pine)', unit: 'each', defaultPrice: 35, category: 'Edging' },
      { name: 'Pavers', unit: 'm²', defaultPrice: 55, category: 'Paving' },
      { name: 'Dripper Line', unit: 'm', defaultPrice: 3.50, category: 'Irrigation' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Landscaping Safety Checklist',
        items: [
          'Underground services located (Dial Before You Dig)',
          'PPE worn (gloves, safety glasses, sun protection)',
          'Chainsaw safety gear (if tree work)',
          'First aid kit accessible',
          'Adequate hydration available',
          'Manual handling techniques followed',
        ],
      },
    ],
    quoteCategories: ['Lawn & Turf', 'Garden Beds', 'Tree Work', 'Irrigation', 'Hardscaping', 'Maintenance'],
    invoicePaymentTerms: 14,
  },

  painting: {
    id: 'painting',
    name: 'Painting & Decorating',
    shortName: 'Painter',
    icon: 'Paintbrush',
    color: '#7c3aed',
    description: 'Interior and exterior painting services',
    typicalJobs: ['House painting', 'Fence painting', 'Prep work', 'Wallpaper', 'Feature walls', 'Commercial painting'],
    terminology: { ...defaultTerminology },
    jobStages: [
      { id: 'pending', name: 'Quote Stage', description: 'Colour consult & quote', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Booked in', color: '#3b82f6' },
      { id: 'in_progress', name: 'Painting', description: 'Work in progress', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Final touch-ups done', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'surfaceType', name: 'Surface Type', type: 'select', options: ['Plaster', 'Brick', 'Timber', 'Metal', 'Render', 'Weatherboard'] },
      { id: 'paintType', name: 'Paint Type', type: 'select', options: ['Water-based', 'Oil-based', 'Epoxy', 'Enamel'] },
      { id: 'finishType', name: 'Finish', type: 'select', options: ['Flat', 'Low Sheen', 'Satin', 'Semi-Gloss', 'Gloss'] },
      { id: 'coatsRequired', name: 'Number of Coats', type: 'number' },
      { id: 'colourCode', name: 'Colour Code', type: 'text', placeholder: 'e.g., Dulux Vivid White' },
    ],
    defaultMaterials: [
      { name: 'Interior Paint (Premium)', unit: 'L', defaultPrice: 85, category: 'Paint' },
      { name: 'Exterior Paint (Premium)', unit: 'L', defaultPrice: 95, category: 'Paint' },
      { name: 'Primer/Sealer', unit: 'L', defaultPrice: 55, category: 'Primers' },
      { name: 'Filler (Interior)', unit: 'kg', defaultPrice: 25, category: 'Prep' },
      { name: 'Sandpaper (Pack)', unit: 'pack', defaultPrice: 18, category: 'Prep' },
      { name: 'Drop Sheet', unit: 'each', defaultPrice: 35, category: 'Protection' },
    ],
    defaultRateCard: {
      hourlyRate: 70,
      calloutFee: 0,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Painting Safety Checklist',
        items: [
          'Area well ventilated',
          'Drop sheets in place',
          'Ladder secured and inspected',
          'PPE worn (mask, safety glasses)',
          'Lead paint test (older properties)',
          'No naked flames near solvents',
        ],
      },
    ],
    quoteCategories: ['Interior Walls', 'Exterior Walls', 'Ceilings', 'Doors & Trim', 'Prep Work', 'Special Finishes'],
    invoicePaymentTerms: 14,
  },

  hvac: {
    id: 'hvac',
    name: 'Air Conditioning & HVAC',
    shortName: 'HVAC Tech',
    icon: 'Wind',
    color: '#0ea5e9',
    description: 'Climate control and ventilation systems',
    typicalJobs: ['AC installation', 'System servicing', 'Duct cleaning', 'Repairs', 'Commercial HVAC', 'Refrigeration'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'systemType', name: 'System Type', type: 'select', options: ['Split System', 'Ducted', 'Cassette', 'Multi-head', 'VRV/VRF', 'Window Unit'] },
      { id: 'capacity', name: 'Capacity', type: 'number', unit: 'kW' },
      { id: 'refrigerantType', name: 'Refrigerant Type', type: 'select', options: ['R32', 'R410A', 'R22 (Legacy)', 'R134a'] },
      { id: 'arcLicenseRequired', name: 'ARC License Work', type: 'checkbox' },
      { id: 'filterSize', name: 'Filter Size', type: 'text' },
    ],
    defaultMaterials: [
      { name: 'Split System 2.5kW', unit: 'each', defaultPrice: 1200, category: 'Units' },
      { name: 'Split System 5kW', unit: 'each', defaultPrice: 1800, category: 'Units' },
      { name: 'Split System 7kW', unit: 'each', defaultPrice: 2400, category: 'Units' },
      { name: 'Refrigerant R32', unit: 'kg', defaultPrice: 85, category: 'Refrigerant' },
      { name: 'Copper Pipe (6.35mm)', unit: 'm', defaultPrice: 18, category: 'Piping' },
      { name: 'Filter (Standard)', unit: 'each', defaultPrice: 35, category: 'Filters' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 95,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'HVAC Safety Checklist',
        items: [
          'Power isolated',
          'Refrigerant recovery equipment ready',
          'ARC license current',
          'PPE worn (gloves, safety glasses)',
          'Ladder secured',
          'Electrical testing completed',
        ],
      },
    ],
    quoteCategories: ['Supply & Install', 'Service & Maintenance', 'Repairs', 'Duct Work', 'Refrigeration'],
    invoicePaymentTerms: 14,
    licenseRequired: 'ARC License + Electrical License',
  },

  roofing: {
    id: 'roofing',
    name: 'Roofing',
    shortName: 'Roofer',
    icon: 'Home',
    color: '#78350f',
    description: 'Roof installation, repairs and restoration',
    typicalJobs: ['Roof repairs', 'Gutter installation', 'Tile replacement', 'Roof restoration', 'Whirlybirds', 'Skylights'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'roofType', name: 'Roof Type', type: 'select', options: ['Tile (Concrete)', 'Tile (Terracotta)', 'Colorbond', 'Zincalume', 'Asbestos (Legacy)'] },
      { id: 'roofPitch', name: 'Roof Pitch', type: 'select', options: ['Low (<15°)', 'Medium (15-25°)', 'Steep (>25°)'] },
      { id: 'roofArea', name: 'Roof Area', type: 'number', unit: 'm²' },
      { id: 'gutterLength', name: 'Gutter Length', type: 'number', unit: 'm' },
      { id: 'asbestosCheck', name: 'Asbestos Check Required', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Roof Tile (Concrete)', unit: 'each', defaultPrice: 4.50, category: 'Tiles' },
      { name: 'Colorbond Roofing', unit: 'm²', defaultPrice: 35, category: 'Metal' },
      { name: 'Gutter (Colorbond)', unit: 'm', defaultPrice: 28, category: 'Gutters' },
      { name: 'Downpipe', unit: 'm', defaultPrice: 22, category: 'Gutters' },
      { name: 'Whirlybird', unit: 'each', defaultPrice: 85, category: 'Ventilation' },
      { name: 'Roof Sealant', unit: 'tube', defaultPrice: 25, category: 'Repairs' },
    ],
    defaultRateCard: {
      hourlyRate: 85,
      calloutFee: 75,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Roofing Safety Checklist',
        items: [
          'Fall arrest system in place',
          'Harness inspected and worn',
          'Roof edge protection installed',
          'Weather conditions checked',
          'Ladder secured at base and top',
          'No working alone at heights',
          'Asbestos identification completed',
        ],
      },
    ],
    quoteCategories: ['Roof Repairs', 'Roof Restoration', 'Gutters & Downpipes', 'New Roofing', 'Ventilation'],
    invoicePaymentTerms: 14,
    licenseRequired: 'Builder License (for structural work)',
  },

  tiling: {
    id: 'tiling',
    name: 'Tiling',
    shortName: 'Tiler',
    icon: 'Grid3x3',
    color: '#0891b2',
    description: 'Floor and wall tiling services',
    typicalJobs: ['Bathroom tiling', 'Kitchen splashbacks', 'Floor tiling', 'Pool tiling', 'Outdoor tiling', 'Grout repairs'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'tileType', name: 'Tile Type', type: 'select', options: ['Ceramic', 'Porcelain', 'Natural Stone', 'Mosaic', 'Large Format'] },
      { id: 'tileSize', name: 'Tile Size', type: 'text', placeholder: 'e.g., 600x600mm' },
      { id: 'areaSize', name: 'Area Size', type: 'number', unit: 'm²' },
      { id: 'waterproofingRequired', name: 'Waterproofing Required', type: 'checkbox' },
      { id: 'groutColour', name: 'Grout Colour', type: 'text' },
    ],
    defaultMaterials: [
      { name: 'Tile Adhesive', unit: 'bag', defaultPrice: 45, category: 'Adhesives' },
      { name: 'Grout', unit: 'bag', defaultPrice: 35, category: 'Grout' },
      { name: 'Waterproofing Membrane', unit: 'L', defaultPrice: 85, category: 'Waterproofing' },
      { name: 'Tile Spacers', unit: 'pack', defaultPrice: 8, category: 'Accessories' },
      { name: 'Tile Trim (Aluminium)', unit: 'm', defaultPrice: 18, category: 'Trim' },
      { name: 'Silicone', unit: 'tube', defaultPrice: 18, category: 'Sealants' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Tiling Safety Checklist',
        items: [
          'Dust mask worn when cutting',
          'Safety glasses worn',
          'Wet saw guards in place',
          'Knee pads worn',
          'Area ventilated (adhesives/sealants)',
          'Sharp tiles disposed safely',
        ],
      },
    ],
    quoteCategories: ['Wall Tiling', 'Floor Tiling', 'Waterproofing', 'Splashbacks', 'Repairs & Regrout'],
    invoicePaymentTerms: 14,
  },

  concreting: {
    id: 'concreting',
    name: 'Concreting',
    shortName: 'Concreter',
    icon: 'Square',
    color: '#64748b',
    description: 'Concrete work, slabs, and foundations',
    typicalJobs: ['Driveways', 'Paths', 'Slabs', 'Retaining walls', 'Exposed aggregate', 'Stamped concrete'],
    terminology: { ...defaultTerminology },
    jobStages: [
      { id: 'pending', name: 'Quote Stage', description: 'Site assessment', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Pour date set', color: '#3b82f6' },
      { id: 'in_progress', name: 'Formwork/Pour', description: 'Concrete work', color: '#f59e0b' },
      { id: 'done', name: 'Cured', description: 'Curing complete', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'concreteType', name: 'Concrete Type', type: 'select', options: ['Standard Grey', 'Exposed Aggregate', 'Stamped/Stencil', 'Coloured', 'Polished'] },
      { id: 'mpaRating', name: 'MPA Rating', type: 'select', options: ['20 MPa', '25 MPa', '32 MPa', '40 MPa'] },
      { id: 'slabThickness', name: 'Slab Thickness', type: 'number', unit: 'mm' },
      { id: 'areaSize', name: 'Area Size', type: 'number', unit: 'm²' },
      { id: 'reinforcement', name: 'Reinforcement', type: 'select', options: ['None', 'Mesh', 'Rebar', 'Fibre'] },
    ],
    defaultMaterials: [
      { name: 'Concrete 25MPa', unit: 'm³', defaultPrice: 250, category: 'Concrete' },
      { name: 'Concrete 32MPa', unit: 'm³', defaultPrice: 280, category: 'Concrete' },
      { name: 'Reinforcing Mesh (SL82)', unit: 'sheet', defaultPrice: 65, category: 'Reinforcement' },
      { name: 'Rebar 12mm', unit: 'm', defaultPrice: 8, category: 'Reinforcement' },
      { name: 'Formwork Timber', unit: 'm', defaultPrice: 12, category: 'Formwork' },
      { name: 'Expansion Joint', unit: 'm', defaultPrice: 8, category: 'Joints' },
    ],
    defaultRateCard: {
      hourlyRate: 85,
      calloutFee: 0,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Concreting Safety Checklist',
        items: [
          'Underground services located',
          'PPE worn (gumboots, gloves, safety glasses)',
          'Concrete truck access clear',
          'Formwork secure',
          'First aid for concrete burns available',
          'Weather conditions checked',
        ],
      },
    ],
    quoteCategories: ['Driveways', 'Paths & Patios', 'Slabs', 'Retaining Walls', 'Decorative Finishes'],
    invoicePaymentTerms: 14,
  },

  fencing: {
    id: 'fencing',
    name: 'Fencing',
    shortName: 'Fencer',
    icon: 'Fence',
    color: '#854d0e',
    description: 'Fence installation and repairs',
    typicalJobs: ['Colorbond fencing', 'Timber fencing', 'Pool fencing', 'Gates', 'Retaining walls', 'Rural fencing'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'fenceType', name: 'Fence Type', type: 'select', options: ['Colorbond', 'Timber', 'Aluminium', 'Pool', 'Chain Link', 'Rural Wire'] },
      { id: 'fenceHeight', name: 'Fence Height', type: 'select', options: ['1.2m', '1.5m', '1.8m', '2.1m', '2.4m'] },
      { id: 'totalLength', name: 'Total Length', type: 'number', unit: 'm' },
      { id: 'gatesRequired', name: 'Gates Required', type: 'number' },
      { id: 'poolCompliant', name: 'Pool Compliant Required', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Colorbond Panel 1.8m', unit: 'm', defaultPrice: 95, category: 'Panels' },
      { name: 'Timber Paling', unit: 'each', defaultPrice: 4.50, category: 'Timber' },
      { name: 'Post (Steel)', unit: 'each', defaultPrice: 45, category: 'Posts' },
      { name: 'Post (Timber)', unit: 'each', defaultPrice: 28, category: 'Posts' },
      { name: 'Gate (Single)', unit: 'each', defaultPrice: 350, category: 'Gates' },
      { name: 'Concrete (Post Mix)', unit: 'bag', defaultPrice: 12, category: 'Concrete' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 20,
    },
    safetyChecklists: [
      {
        name: 'Fencing Safety Checklist',
        items: [
          'Underground services located (Dial Before You Dig)',
          'Property boundaries confirmed',
          'PPE worn',
          'Power tools inspected',
          'Neighbour notification (if required)',
          'Pool compliance requirements checked',
        ],
      },
    ],
    quoteCategories: ['Colorbond', 'Timber', 'Pool Fencing', 'Gates', 'Repairs', 'Rural'],
    invoicePaymentTerms: 14,
  },

  cleaning: {
    id: 'cleaning',
    name: 'Cleaning Services',
    shortName: 'Cleaner',
    icon: 'Sparkles',
    color: '#06b6d4',
    description: 'Professional cleaning and maintenance',
    typicalJobs: ['End of lease', 'Carpet cleaning', 'Window cleaning', 'Regular cleaning', 'Commercial cleaning', 'Pressure washing'],
    terminology: {
      job: 'Booking',
      jobs: 'Bookings',
      client: 'Client',
      clients: 'Clients',
      quote: 'Quote',
      quotes: 'Quotes',
      worksite: 'Property',
      worksites: 'Properties',
    },
    jobStages: [
      { id: 'pending', name: 'Enquiry', description: 'New request', color: '#6b7280' },
      { id: 'scheduled', name: 'Booked', description: 'Appointment set', color: '#3b82f6' },
      { id: 'in_progress', name: 'Cleaning', description: 'In progress', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Cleaning finished', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Invoice sent', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'propertyType', name: 'Property Type', type: 'select', options: ['House', 'Unit/Apartment', 'Office', 'Commercial', 'Industrial'] },
      { id: 'bedrooms', name: 'Bedrooms', type: 'number' },
      { id: 'bathrooms', name: 'Bathrooms', type: 'number' },
      { id: 'cleaningType', name: 'Cleaning Type', type: 'select', options: ['Regular', 'Deep Clean', 'End of Lease', 'Move-in', 'One-off'] },
      { id: 'frequency', name: 'Frequency', type: 'select', options: ['One-off', 'Weekly', 'Fortnightly', 'Monthly'] },
    ],
    defaultMaterials: [
      { name: 'Cleaning Supplies (Standard)', unit: 'set', defaultPrice: 35, category: 'Supplies' },
      { name: 'Carpet Cleaning', unit: 'room', defaultPrice: 45, category: 'Carpet' },
      { name: 'Oven Cleaning', unit: 'each', defaultPrice: 65, category: 'Appliances' },
      { name: 'Window Cleaning (per window)', unit: 'each', defaultPrice: 15, category: 'Windows' },
      { name: 'Pressure Washing', unit: 'm²', defaultPrice: 5, category: 'External' },
    ],
    defaultRateCard: {
      hourlyRate: 55,
      calloutFee: 0,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 10,
    },
    safetyChecklists: [
      {
        name: 'Cleaning Safety Checklist',
        items: [
          'Chemical safety labels read',
          'Gloves and PPE worn',
          'Wet floor signs placed',
          'Adequate ventilation',
          'Ladder safety (if required)',
          'Electrical safety around water',
        ],
      },
    ],
    quoteCategories: ['Regular Cleaning', 'Deep Clean', 'End of Lease', 'Carpet & Upholstery', 'Windows', 'External'],
    invoicePaymentTerms: 7,
  },

  handyman: {
    id: 'handyman',
    name: 'Handyman Services',
    shortName: 'Handyman',
    icon: 'Wrench',
    color: '#6b7280',
    description: 'General repairs and maintenance',
    typicalJobs: ['Door repairs', 'Furniture assembly', 'Picture hanging', 'Minor plumbing', 'Minor electrical', 'General repairs'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'jobType', name: 'Job Category', type: 'select', options: ['Repairs', 'Assembly', 'Installation', 'Maintenance', 'Multiple Tasks'] },
      { id: 'estimatedTime', name: 'Estimated Time', type: 'number', unit: 'hours' },
      { id: 'materialsIncluded', name: 'Materials Included', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'General Hardware Kit', unit: 'set', defaultPrice: 50, category: 'Hardware' },
      { name: 'Screws & Fixings Assorted', unit: 'pack', defaultPrice: 25, category: 'Hardware' },
      { name: 'Silicone Sealant', unit: 'tube', defaultPrice: 18, category: 'Sealants' },
      { name: 'Paint Touch-up', unit: 'can', defaultPrice: 35, category: 'Paint' },
    ],
    defaultRateCard: {
      hourlyRate: 65,
      calloutFee: 50,
      afterHoursMultiplier: 1.25,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'General Safety Checklist',
        items: [
          'PPE appropriate for task',
          'Power tools inspected',
          'Work area clear',
          'First aid kit accessible',
          'Know limitations (licensed work)',
        ],
      },
    ],
    quoteCategories: ['Repairs', 'Assembly', 'Installation', 'Maintenance', 'Multiple Tasks'],
    invoicePaymentTerms: 7,
  },

  general: {
    id: 'general',
    name: 'General Trade Services',
    shortName: 'Tradie',
    icon: 'Wrench',
    color: '#6b7280',
    description: 'General trade and contractor services',
    typicalJobs: ['General repairs', 'Maintenance', 'Installations', 'Consultations', 'Custom work', 'Assessments'],
    terminology: { ...defaultTerminology },
    jobStages: defaultJobStages,
    customFields: [
      { id: 'serviceType', name: 'Service Type', type: 'text', placeholder: 'Type of service provided' },
      { id: 'estimatedDuration', name: 'Estimated Duration', type: 'number', unit: 'hours' },
    ],
    defaultMaterials: [
      { name: 'General Materials', unit: 'lot', defaultPrice: 100, category: 'Materials' },
      { name: 'Hardware Supplies', unit: 'set', defaultPrice: 50, category: 'Hardware' },
    ],
    defaultRateCard: {
      hourlyRate: 75,
      calloutFee: 50,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 1.5,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'General Safety Checklist',
        items: [
          'PPE appropriate for task',
          'Work area inspected',
          'Tools and equipment checked',
          'Emergency procedures known',
        ],
      },
    ],
    quoteCategories: ['Labour', 'Materials', 'Equipment', 'Travel', 'Other'],
    invoicePaymentTerms: 14,
  },

  grounds_maintenance: {
    id: 'grounds_maintenance',
    name: 'Grounds & Vegetation Management',
    shortName: 'Grounds Crew',
    icon: 'Leaf',
    color: '#15803d',
    description: 'Large-scale grounds, parks, and vegetation management',
    typicalJobs: ['Park maintenance', 'Vegetation clearing', 'Mowing contracts', 'Weed control', 'Tree management', 'Sports field maintenance'],
    terminology: {
      job: 'Work Order',
      jobs: 'Work Orders',
      client: 'Contract',
      clients: 'Contracts',
      quote: 'Tender',
      quotes: 'Tenders',
      worksite: 'Zone',
      worksites: 'Zones',
    },
    jobStages: [
      { id: 'pending', name: 'Assigned', description: 'Work order assigned', color: '#6b7280' },
      { id: 'scheduled', name: 'Scheduled', description: 'Date allocated', color: '#3b82f6' },
      { id: 'in_progress', name: 'In Progress', description: 'Work underway', color: '#f59e0b' },
      { id: 'done', name: 'Complete', description: 'Signed off', color: '#22c55e' },
      { id: 'invoiced', name: 'Invoiced', description: 'Claimed', color: '#8b5cf6' },
    ],
    customFields: [
      { id: 'zoneId', name: 'Zone/Area ID', type: 'text' },
      { id: 'areaSize', name: 'Area Size', type: 'number', unit: 'hectares' },
      { id: 'serviceType', name: 'Service Type', type: 'select', options: ['Mowing', 'Vegetation Clearing', 'Weed Control', 'Tree Work', 'General Maintenance'] },
      { id: 'frequency', name: 'Service Frequency', type: 'select', options: ['As Required', 'Weekly', 'Fortnightly', 'Monthly', 'Quarterly'] },
      { id: 'contractNumber', name: 'Contract Number', type: 'text' },
      { id: 'beforePhoto', name: 'Before Photo Required', type: 'checkbox' },
      { id: 'afterPhoto', name: 'After Photo Required', type: 'checkbox' },
    ],
    defaultMaterials: [
      { name: 'Herbicide (Roundup)', unit: 'L', defaultPrice: 45, category: 'Chemicals' },
      { name: 'Fuel', unit: 'L', defaultPrice: 2.20, category: 'Fuel' },
      { name: 'Mulch', unit: 'm³', defaultPrice: 85, category: 'Materials' },
      { name: 'Turf Repair', unit: 'm²', defaultPrice: 18, category: 'Turf' },
      { name: 'Tree Removal (Small)', unit: 'each', defaultPrice: 450, category: 'Trees' },
      { name: 'Stump Grinding', unit: 'each', defaultPrice: 250, category: 'Trees' },
    ],
    defaultRateCard: {
      hourlyRate: 95,
      calloutFee: 0,
      afterHoursMultiplier: 1.5,
      weekendMultiplier: 2.0,
      materialMarkupPct: 15,
    },
    safetyChecklists: [
      {
        name: 'Grounds Maintenance Safety',
        items: [
          'SWMS/JSA reviewed and signed',
          'Traffic management plan in place',
          'PPE worn (hearing, eye, sun protection)',
          'Chainsaw safety gear (if tree work)',
          'Chemical handling procedures followed',
          'First aid kit and emergency plan accessible',
          'Equipment pre-start checks completed',
          'Public exclusion zones established',
        ],
      },
    ],
    quoteCategories: ['Mowing & Edging', 'Vegetation Clearing', 'Weed Control', 'Tree Management', 'Irrigation', 'Sports Fields'],
    invoicePaymentTerms: 30,
  },
};

export type TradeId = keyof typeof tradeCatalog;

export const getTradeDefinition = (tradeId: string): TradeDefinition | undefined => {
  return tradeCatalog[tradeId];
};

export const getAllTrades = (): TradeDefinition[] => {
  return Object.values(tradeCatalog);
};

export const getTradeOptions = (): { value: string; label: string }[] => {
  return Object.entries(tradeCatalog).map(([id, trade]) => ({
    value: id,
    label: trade.name,
  }));
};

export const getTradeTerminology = (tradeId: string): TradeTerminology => {
  const trade = tradeCatalog[tradeId];
  return trade?.terminology || defaultTerminology;
};

export const getTradeJobStages = (tradeId: string): TradeJobStage[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.jobStages || defaultJobStages;
};

export const getTradeCustomFields = (tradeId: string): TradeCustomField[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.customFields || [];
};

export const getTradeDefaultMaterials = (tradeId: string): TradeMaterial[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.defaultMaterials || [];
};

export const getTradeDefaultRateCard = (tradeId: string): TradeRateCard => {
  const trade = tradeCatalog[tradeId];
  return trade?.defaultRateCard || {
    hourlyRate: 75,
    calloutFee: 50,
    afterHoursMultiplier: 1.5,
    weekendMultiplier: 1.5,
    materialMarkupPct: 15,
  };
};

export const getTradeSafetyChecklists = (tradeId: string): TradeSafetyChecklist[] => {
  const trade = tradeCatalog[tradeId];
  return trade?.safetyChecklists || [];
};
