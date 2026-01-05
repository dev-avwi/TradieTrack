// Comprehensive tradie template data for all trade types and specializations
export const tradieQuoteTemplates = [
  // PLUMBING TEMPLATES (Multiple varieties)
  {
    type: 'quote',
    familyKey: 'plumbing-basic',
    name: 'Basic Plumbing Quote',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Plumbing Services Quote',
      description: 'Professional plumbing services for your property',
      terms: 'Quote valid for 30 days. 50% deposit required to commence work. All work guaranteed for 12 months. Materials and labour included. GST included where applicable.',
      depositPct: 50,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Labour - Plumbing services',
        qty: 1,
        unitPrice: 120.00,
        unit: 'hour'
      },
      {
        description: 'Call-out fee',
        qty: 1,
        unitPrice: 80.00,
        unit: 'flat'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'plumbing-emergency',
    name: 'Emergency Plumbing Quote',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Emergency Plumbing Services Quote',
      description: 'Urgent plumbing repairs - 24/7 emergency response',
      terms: 'Quote valid for 7 days. Emergency rate applies. Payment due on completion. All emergency work guaranteed for 6 months. After-hours surcharge applies. GST included.',
      depositPct: 25,
      dueTermDays: 7,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Emergency labour (after hours)',
        qty: 1,
        unitPrice: 180.00,
        unit: 'hour'
      },
      {
        description: 'Emergency call-out fee',
        qty: 1,
        unitPrice: 120.00,
        unit: 'flat'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'plumbing-bathroom',
    name: 'Bathroom Renovation Quote',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Bathroom Renovation - Plumbing Quote',
      description: 'Complete bathroom plumbing installation and renovation',
      terms: 'Quote valid for 45 days. Progress payments: 30% deposit, 40% rough-in completion, 30% final completion. All fixtures and fittings included. 12-month guarantee on workmanship. Waterproofing compliance certificate provided. GST included.',
      depositPct: 30,
      dueTermDays: 45,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Bathroom strip out and rough-in',
        qty: 1,
        unitPrice: 850.00,
        unit: 'job'
      },
      {
        description: 'Toilet installation',
        qty: 1,
        unitPrice: 280.00,
        unit: 'each'
      },
      {
        description: 'Vanity and basin installation',
        qty: 1,
        unitPrice: 420.00,
        unit: 'each'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'plumbing-hotwater',
    name: 'Hot Water System Quote',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Hot Water System Installation Quote',
      description: 'Supply and install new hot water system with full warranty',
      terms: 'Quote valid for 30 days. Hot water system includes 5-year manufacturer warranty. Installation guaranteed for 12 months. Old unit disposal included. Compliance certificate provided. GST included.',
      depositPct: 40,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Electric hot water system (315L)',
        qty: 1,
        unitPrice: 1200.00,
        unit: 'each'
      },
      {
        description: 'Installation labour',
        qty: 4,
        unitPrice: 120.00,
        unit: 'hour'
      },
      {
        description: 'Old system disposal',
        qty: 1,
        unitPrice: 150.00,
        unit: 'flat'
      }
    ]
  },

  // ELECTRICAL TEMPLATES (Multiple varieties)
  {
    type: 'quote',
    familyKey: 'electrical-basic',
    name: 'Basic Electrical Quote',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Electrical Services Quote',
      description: 'Licensed electrical work for your property',
      terms: 'Quote valid for 30 days. 50% deposit required. All electrical work complies with AS/NZS 3000:2018. Certificate of electrical safety provided. GST included.',
      depositPct: 50,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Labour - Licensed electrician',
        qty: 1,
        unitPrice: 135.00,
        unit: 'hour'
      },
      {
        description: 'Call-out fee',
        qty: 1,
        unitPrice: 90.00,
        unit: 'flat'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'electrical-switchboard',
    name: 'Switchboard Upgrade Quote',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Switchboard Upgrade Quote',
      description: 'Complete switchboard replacement with safety switches and circuit breakers',
      terms: 'Quote valid for 30 days. Work requires power disconnection. All work complies with current electrical standards. Certificate of electrical safety included. 12-month workmanship guarantee. GST included.',
      depositPct: 60,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'New switchboard with safety switches',
        qty: 1,
        unitPrice: 1200.00,
        unit: 'each'
      },
      {
        description: 'Installation labour (licensed electrician)',
        qty: 6,
        unitPrice: 135.00,
        unit: 'hour'
      },
      {
        description: 'Electrical safety certificate',
        qty: 1,
        unitPrice: 80.00,
        unit: 'flat'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'electrical-aircon',
    name: 'Air Conditioning Electrical Quote',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Air Conditioning Electrical Installation Quote',
      description: 'Electrical installation for new air conditioning system',
      terms: 'Quote valid for 30 days. Dedicated circuit required for air conditioning. All work complies with AS/NZS 3000:2018. Certificate provided. Coordinate with AC installer. GST included.',
      depositPct: 50,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Dedicated AC circuit (20 amp)',
        qty: 1,
        unitPrice: 450.00,
        unit: 'each'
      },
      {
        description: 'Isolation switch installation',
        qty: 1,
        unitPrice: 180.00,
        unit: 'each'
      },
      {
        description: 'Cable run and connection',
        qty: 4,
        unitPrice: 135.00,
        unit: 'hour'
      }
    ]
  },

  // CARPENTRY TEMPLATES (Multiple varieties)
  {
    type: 'quote',
    familyKey: 'carpentry-basic',
    name: 'Basic Carpentry Quote',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Carpentry Services Quote',
      description: 'Quality carpentry and building services',
      terms: 'Quote valid for 30 days. Materials and labour included. Progress payments as work proceeds. All timber work guaranteed. GST included where applicable.',
      depositPct: 30,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Labour - Carpentry services',
        qty: 1,
        unitPrice: 110.00,
        unit: 'hour'
      },
      {
        description: 'Materials - Timber and fixings',
        qty: 1,
        unitPrice: 0.00,
        unit: 'estimate'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'carpentry-deck',
    name: 'Deck Construction Quote',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Timber Deck Construction Quote',
      description: 'Custom timber deck construction with quality materials',
      terms: 'Quote valid for 45 days. Progress payments: 30% deposit, 40% materials delivery, 30% completion. Premium treated pine or hardwood options. 12-month structural guarantee. Council permit assistance available. GST included.',
      depositPct: 30,
      dueTermDays: 45,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Deck framing (treated pine)',
        qty: 1,
        unitPrice: 28.00,
        unit: 'sqm'
      },
      {
        description: 'Decking boards (90x19 treated pine)',
        qty: 1,
        unitPrice: 35.00,
        unit: 'sqm'
      },
      {
        description: 'Balustrade and handrail',
        qty: 1,
        unitPrice: 120.00,
        unit: 'lineal metre'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'carpentry-kitchen',
    name: 'Kitchen Cabinet Quote',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Custom Kitchen Cabinet Quote',
      description: 'Bespoke kitchen cabinetry design and installation',
      terms: 'Quote valid for 60 days. Custom design and 3D render included. Progress payments: 40% deposit, 30% manufacture, 30% installation. Premium materials and soft-close hardware. 5-year guarantee on workmanship. GST included.',
      depositPct: 40,
      dueTermDays: 60,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Design and 3D rendering',
        qty: 1,
        unitPrice: 350.00,
        unit: 'flat'
      },
      {
        description: 'Base cabinet construction',
        qty: 1,
        unitPrice: 800.00,
        unit: 'lineal metre'
      },
      {
        description: 'Wall cabinet construction',
        qty: 1,
        unitPrice: 650.00,
        unit: 'lineal metre'
      },
      {
        description: 'Stone benchtop (20mm)',
        qty: 1,
        unitPrice: 450.00,
        unit: 'sqm'
      }
    ]
  },

  // HVAC TEMPLATES (Multiple varieties)
  {
    type: 'quote',
    familyKey: 'hvac-basic',
    name: 'Basic HVAC Quote',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Air Conditioning & Heating Quote',
      description: 'Professional HVAC installation and maintenance',
      terms: 'Quote valid for 30 days. Licensed refrigeration technician. Warranty on parts and labour. Compliance certificate provided. GST included.',
      depositPct: 40,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Labour - HVAC technician',
        qty: 1,
        unitPrice: 140.00,
        unit: 'hour'
      },
      {
        description: 'Equipment - HVAC unit',
        qty: 1,
        unitPrice: 0.00,
        unit: 'each'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'hvac-installation',
    name: 'Split System Installation Quote',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Split System Air Conditioner Installation Quote',
      description: 'Supply and install split system air conditioning with warranty',
      terms: 'Quote valid for 30 days. Licensed refrigeration work. 5-year manufacturer warranty. 12-month installation guarantee. Electrical work by licensed electrician. Compliance certificate included. GST included.',
      depositPct: 50,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Split system air conditioner (7kW)',
        qty: 1,
        unitPrice: 1800.00,
        unit: 'each'
      },
      {
        description: 'Installation labour (licensed tech)',
        qty: 6,
        unitPrice: 140.00,
        unit: 'hour'
      },
      {
        description: 'Copper pipes and insulation',
        qty: 8,
        unitPrice: 45.00,
        unit: 'metre'
      },
      {
        description: 'Electrical connection',
        qty: 1,
        unitPrice: 380.00,
        unit: 'flat'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'hvac-ducted',
    name: 'Ducted System Quote',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Ducted Air Conditioning System Quote',
      description: 'Complete ducted air conditioning system with zoning controls',
      terms: 'Quote valid for 45 days. Progress payments: 40% deposit, 40% rough-in, 20% commissioning. Licensed refrigeration and electrical work. 5-year system warranty. Zoning controls included. GST included.',
      depositPct: 40,
      dueTermDays: 45,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Ducted air conditioning unit (12kW)',
        qty: 1,
        unitPrice: 4500.00,
        unit: 'each'
      },
      {
        description: 'Ductwork installation',
        qty: 25,
        unitPrice: 85.00,
        unit: 'metre'
      },
      {
        description: 'Zone controllers and dampers',
        qty: 1,
        unitPrice: 1200.00,
        unit: 'system'
      },
      {
        description: 'Installation and commissioning',
        qty: 16,
        unitPrice: 140.00,
        unit: 'hour'
      }
    ]
  },

  // PAINTING TEMPLATES (Multiple varieties)
  {
    type: 'quote',
    familyKey: 'painting-basic',
    name: 'Basic Painting Quote',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Painting Services Quote',
      description: 'Professional interior and exterior painting',
      terms: 'Quote valid for 30 days. All paints and materials included. Surface preparation included. Clean-up included. 5-year guarantee on workmanship. GST included.',
      depositPct: 25,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Labour - Painting services',
        qty: 1,
        unitPrice: 95.00,
        unit: 'hour'
      },
      {
        description: 'Materials - Paint and supplies',
        qty: 1,
        unitPrice: 0.00,
        unit: 'estimate'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'painting-interior',
    name: 'Interior House Painting Quote',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Interior House Painting Quote',
      description: 'Complete interior house painting with premium finishes',
      terms: 'Quote valid for 45 days. Premium paint included (2 coats). All surface preparation and filling. Furniture protection. Clean-up included. 7-year guarantee on paint finish. GST included.',
      depositPct: 30,
      dueTermDays: 45,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Wall preparation and priming',
        qty: 1,
        unitPrice: 15.00,
        unit: 'sqm'
      },
      {
        description: 'Wall painting (2 coats premium)',
        qty: 1,
        unitPrice: 22.00,
        unit: 'sqm'
      },
      {
        description: 'Ceiling painting (2 coats)',
        qty: 1,
        unitPrice: 18.00,
        unit: 'sqm'
      },
      {
        description: 'Trim and door painting',
        qty: 1,
        unitPrice: 45.00,
        unit: 'lineal metre'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'painting-exterior',
    name: 'Exterior House Painting Quote',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Exterior House Painting Quote',
      description: 'Complete exterior house painting with weather protection',
      terms: 'Quote valid for 30 days. Weather-dependent work. Premium exterior paint (2 coats). High-pressure cleaning included. All surface preparation. 10-year paint guarantee. GST included.',
      depositPct: 30,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'High-pressure cleaning',
        qty: 1,
        unitPrice: 12.00,
        unit: 'sqm'
      },
      {
        description: 'Surface preparation and repairs',
        qty: 1,
        unitPrice: 18.00,
        unit: 'sqm'
      },
      {
        description: 'Exterior painting (2 coats)',
        qty: 1,
        unitPrice: 28.00,
        unit: 'sqm'
      },
      {
        description: 'Trim and fascia painting',
        qty: 1,
        unitPrice: 35.00,
        unit: 'lineal metre'
      }
    ]
  },

  // LANDSCAPING TEMPLATES (Multiple varieties)
  {
    type: 'quote',
    familyKey: 'landscaping-basic',
    name: 'Basic Landscaping Quote',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Landscaping Services Quote',
      description: 'Professional garden and landscaping services',
      terms: 'Quote valid for 30 days. Plants and materials included. Site preparation included. Maintenance advice provided. 6-month plant guarantee. GST included.',
      depositPct: 30,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Labour - Landscaping services',
        qty: 1,
        unitPrice: 85.00,
        unit: 'hour'
      },
      {
        description: 'Materials - Plants and supplies',
        qty: 1,
        unitPrice: 0.00,
        unit: 'estimate'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'landscaping-garden',
    name: 'Garden Design & Installation Quote',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Garden Design & Installation Quote',
      description: 'Complete garden design with plant selection and installation',
      terms: 'Quote valid for 45 days. Design concept included. Quality plants with guarantee. Soil conditioning included. Mulching and establishment care. 12-month plant replacement guarantee. GST included.',
      depositPct: 40,
      dueTermDays: 45,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Garden design consultation',
        qty: 1,
        unitPrice: 150.00,
        unit: 'flat'
      },
      {
        description: 'Site preparation and soil improvement',
        qty: 1,
        unitPrice: 25.00,
        unit: 'sqm'
      },
      {
        description: 'Plant supply and installation',
        qty: 1,
        unitPrice: 45.00,
        unit: 'sqm'
      },
      {
        description: 'Mulching and finishing',
        qty: 1,
        unitPrice: 12.00,
        unit: 'sqm'
      }
    ]
  },
  {
    type: 'quote',
    familyKey: 'landscaping-irrigation',
    name: 'Irrigation System Quote',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: true
    },
    defaults: {
      title: 'Automated Irrigation System Quote',
      description: 'Professional irrigation system design and installation',
      terms: 'Quote valid for 30 days. Automated timer system included. Quality dripper and sprinkler components. System design for water efficiency. 12-month warranty on installation. GST included.',
      depositPct: 50,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Irrigation controller (8-zone)',
        qty: 1,
        unitPrice: 380.00,
        unit: 'each'
      },
      {
        description: 'Pipe installation (25mm poly)',
        qty: 1,
        unitPrice: 18.00,
        unit: 'metre'
      },
      {
        description: 'Pop-up sprinkler heads',
        qty: 1,
        unitPrice: 35.00,
        unit: 'each'
      },
      {
        description: 'Installation labour',
        qty: 8,
        unitPrice: 85.00,
        unit: 'hour'
      }
    ]
  },

  // JOB TEMPLATES (Multiple varieties for each trade)
  
  // PLUMBING JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'plumbing-maintenance',
    name: 'Plumbing Maintenance Job',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Routine Plumbing Maintenance',
      description: 'Regular maintenance and inspection of plumbing systems including taps, toilets, and hot water.',
      terms: 'Annual maintenance contract. Includes inspection of all taps, toilets, hot water system. Minor repairs included. Emergency call-out priority. Work compliant with AS/NZS 3500.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'plumbing-blocked-drain',
    name: 'Blocked Drain Clearing Job',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Blocked Drain Clearing',
      description: 'Professional drain clearing using high-pressure water jetting and CCTV inspection.',
      terms: 'Work guaranteed for 3 months. CCTV footage provided on request. Compliant with AS/NZS 3500. Root cutting and debris removal included.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'plumbing-leak-repair',
    name: 'Leak Detection & Repair Job',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Leak Detection & Repair',
      description: 'Locate and repair water leaks in pipes, fittings, and fixtures using advanced detection equipment.',
      terms: 'Leak detection report provided. Repairs guaranteed for 12 months. Water damage assessment included. Compliant with AS/NZS 3500.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'plumbing-hot-water-service',
    name: 'Hot Water System Service Job',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Hot Water System Service',
      description: 'Complete service and maintenance of electric, gas, or solar hot water systems.',
      terms: 'Service includes anode inspection, pressure relief valve test, and thermostat check. Extends system life. Manufacturer warranty preserved. Compliant with AS/NZS 3500.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'plumbing-gas-fitting',
    name: 'Gas Fitting & Appliance Connection Job',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Gas Fitting & Appliance Connection',
      description: 'Licensed gas fitting for cooktops, heaters, BBQs, and other gas appliances.',
      terms: 'Licensed gas fitter. Gas compliance certificate provided. Work compliant with AS/NZS 5601. Pressure testing included. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'plumbing-backflow-testing',
    name: 'Backflow Prevention Testing Job',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Backflow Prevention Testing',
      description: 'Annual backflow prevention device testing and certification as required by water authorities.',
      terms: 'Accredited backflow tester. Test report submitted to water authority. Compliant with AS/NZS 3500.1. Device registration maintained.'
    },
    defaultLineItems: []
  },

  // ELECTRICAL JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'electrical-safety',
    name: 'Electrical Safety Inspection Job',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Electrical Safety Inspection',
      description: 'Comprehensive electrical safety check and testing of all circuits and equipment.',
      terms: 'AS/NZS 3000:2018 compliant testing. Certificate of Electrical Safety provided. Includes switchboard, RCD, and circuit testing.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'electrical-powerpoint-install',
    name: 'Power Point Installation Job',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Power Point Installation',
      description: 'Install new power points including GPOs, USB outlets, and outdoor weatherproof outlets.',
      terms: 'Licensed electrician. All work compliant with AS/NZS 3000:2018. Certificate of Electrical Safety provided. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'electrical-lighting-install',
    name: 'Lighting Installation Job',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Lighting Installation',
      description: 'Supply and install indoor and outdoor lighting including LED downlights, pendants, and garden lights.',
      terms: 'Licensed electrician. Energy-efficient LED options available. Compliant with AS/NZS 3000:2018. Dimmer switches available. 12-month guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'electrical-switchboard-upgrade',
    name: 'Switchboard Upgrade Job',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Switchboard Upgrade',
      description: 'Replace old ceramic fuse switchboard with modern safety switch and circuit breaker board.',
      terms: 'Licensed electrician. Temporary power disconnection required. All work compliant with AS/NZS 3000:2018. Certificate of Electrical Safety provided. RCDs installed for personal protection.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'electrical-smoke-alarm',
    name: 'Smoke Alarm Installation Job',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Smoke Alarm Installation & Compliance',
      description: 'Install interconnected smoke alarms to meet Australian residential compliance requirements.',
      terms: 'Compliant with AS 3786 and state legislation. Interconnected alarms as required. Certificate of compliance provided. 10-year battery life options available.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'electrical-ev-charger',
    name: 'EV Charger Installation Job',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Electric Vehicle Charger Installation',
      description: 'Install dedicated EV charging circuit and wall-mounted charging station for electric vehicles.',
      terms: 'Licensed electrician. Dedicated 32A or 40A circuit required. Compliant with AS/NZS 3000:2018. Smart charging options available. Manufacturer warranty applies.'
    },
    defaultLineItems: []
  },

  // CARPENTRY JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'carpentry-deck-build',
    name: 'Deck Construction Job',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Timber Deck Construction',
      description: 'Design and construct custom timber deck using treated pine, hardwood, or composite decking.',
      terms: 'Structural warranty 12 months. Council permit application assistance available. Compliant with NCC/BCA requirements. Handrails to AS 1170.1 if required.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'carpentry-pergola',
    name: 'Pergola Construction Job',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Pergola Construction',
      description: 'Custom pergola design and construction with options for shade cloth, polycarbonate, or open rafters.',
      terms: 'Structural warranty 12 months. Council permit assistance if required. Compliant with NCC/BCA. Options for attached or freestanding designs.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'carpentry-door-install',
    name: 'Door Installation & Replacement Job',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Door Installation & Replacement',
      description: 'Supply and install interior and exterior doors including frames, hardware, and weather seals.',
      terms: 'Includes frame adjustment and hardware installation. Fire door compliance where required. Old door disposal available. 12-month guarantee on workmanship.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'carpentry-fence-build',
    name: 'Fence Construction Job',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Timber Fence Construction',
      description: 'Build timber fencing including paling, lapped, and decorative styles with concrete-set posts.',
      terms: 'Boundary survey responsibility of property owner. Council regulations followed. Posts concreted for stability. Treated pine or hardwood options. 12-month structural guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'carpentry-window-install',
    name: 'Window Installation Job',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Window Installation & Replacement',
      description: 'Remove and replace windows including timber, aluminium, and double-glazed units.',
      terms: 'Weatherproofing and flashing included. Compliant with NCC energy requirements. Old window disposal available. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'carpentry-shelving',
    name: 'Custom Shelving & Storage Job',
    tradeType: 'carpentry',
    styling: {
      brandColor: '#ea580c',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Custom Shelving & Storage',
      description: 'Design and build custom shelving, wardrobes, and storage solutions tailored to your space.',
      terms: 'Custom design consultation included. Premium materials and soft-close hardware. Built-in or freestanding options. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },

  // HVAC JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'hvac-split-install',
    name: 'Split System Installation Job',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Split System Air Conditioner Installation',
      description: 'Supply and install wall-mounted split system air conditioner with outdoor unit.',
      terms: 'Licensed refrigeration technician. 5-year manufacturer warranty. Electrical work by licensed electrician. Compliant with AS/NZS 5149. Includes commissioning and user training.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'hvac-service',
    name: 'Air Conditioning Service Job',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Air Conditioning Service & Clean',
      description: 'Complete service including filter clean, coil clean, refrigerant check, and performance test.',
      terms: 'Licensed technician. Maintains manufacturer warranty. Improves efficiency and air quality. Refrigerant top-up if required at additional cost. Service report provided.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'hvac-ducted-install',
    name: 'Ducted System Installation Job',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Ducted Air Conditioning Installation',
      description: 'Complete ducted air conditioning system with zoning, ductwork, and central controller.',
      terms: 'Licensed refrigeration technician. 5-year manufacturer warranty on unit. Ductwork design for optimal airflow. Zone control system included. Compliant with AS/NZS 5149.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'hvac-repair',
    name: 'Air Conditioning Repair Job',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Air Conditioning Repair',
      description: 'Diagnose and repair faults in split, ducted, and multi-head air conditioning systems.',
      terms: 'Licensed refrigeration technician. Diagnostic fee applies. Parts warranty as per manufacturer. Labour guaranteed 3 months. Compliant with AS/NZS 5149.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'hvac-gas-heater-service',
    name: 'Gas Heater Service Job',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Gas Heater Service & Safety Check',
      description: 'Annual gas heater service including burner clean, flue inspection, and carbon monoxide testing.',
      terms: 'Licensed gas technician. Carbon monoxide testing included. Maintains manufacturer warranty. Service sticker applied. Compliant with AS/NZS 5601.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'hvac-duct-cleaning',
    name: 'Duct Cleaning Job',
    tradeType: 'hvac',
    styling: {
      brandColor: '#0ea5e9',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Duct Cleaning Service',
      description: 'Professional cleaning of air conditioning ducts, vents, and return air grilles.',
      terms: 'Removes dust, allergens, and mould. Improves air quality and system efficiency. Before and after photos provided. Sanitising treatment available.'
    },
    defaultLineItems: []
  },

  // PAINTING JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'painting-interior',
    name: 'Interior Painting Job',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Interior House Painting',
      description: 'Complete interior painting including walls, ceilings, doors, and trim with premium paints.',
      terms: 'Surface preparation and gap filling included. Premium paint brands used. Furniture protection included. Clean-up included. 7-year paint guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'painting-exterior',
    name: 'Exterior Painting Job',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Exterior House Painting',
      description: 'Complete exterior painting including weatherboards, render, trim, and fascia with weather-resistant paints.',
      terms: 'High-pressure cleaning included. Premium exterior paints used. Weather-dependent scheduling. Scaffolding arranged if required. 10-year paint guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'painting-fence',
    name: 'Fence Painting & Staining Job',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Fence Painting & Staining',
      description: 'Paint or stain timber fencing with options for solid colour or natural timber finish.',
      terms: 'Surface preparation included. UV-resistant stains available. Extends fence life. Minor repairs included. 5-year guarantee on finish.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'painting-deck-stain',
    name: 'Deck Staining & Oiling Job',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Deck Staining & Oiling',
      description: 'Sand and apply protective stain or decking oil to timber deck surfaces.',
      terms: 'Light sanding included. Deck cleaning prior to application. Premium decking oils used. Extends timber life and appearance. Reapplication recommended annually.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'painting-commercial',
    name: 'Commercial Painting Job',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Commercial Painting',
      description: 'Professional painting for offices, retail spaces, and commercial buildings.',
      terms: 'After-hours work available to minimise disruption. Low-VOC paints available. OHS compliant. Fully insured. Progress payments for large projects.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'painting-wallpaper',
    name: 'Wallpaper Installation Job',
    tradeType: 'painting',
    styling: {
      brandColor: '#7c3aed',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Wallpaper Installation',
      description: 'Professional wallpaper hanging including feature walls and full room installations.',
      terms: 'Wall preparation included. Pattern matching guaranteed. Premium adhesives used. Old wallpaper removal available. 5-year installation guarantee.'
    },
    defaultLineItems: []
  },

  // LANDSCAPING JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'landscaping-garden-design',
    name: 'Garden Design & Installation Job',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Garden Design & Installation',
      description: 'Complete garden design with plant selection, soil preparation, and professional installation.',
      terms: 'Design consultation included. Quality plants with 6-month guarantee. Soil conditioning and mulching included. Watering schedule and care instructions provided.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'landscaping-lawn-install',
    name: 'Lawn Installation Job',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Turf & Lawn Installation',
      description: 'Supply and lay new lawn turf including soil preparation, levelling, and establishment care.',
      terms: 'Site levelling and soil preparation included. Premium turf varieties available. Starter fertiliser applied. Watering guide provided. 6-week establishment guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'landscaping-irrigation',
    name: 'Irrigation System Installation Job',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Irrigation System Installation',
      description: 'Design and install automated irrigation system with timer, sprinklers, and drip lines.',
      terms: 'Smart controller available. Water-efficient design. Backflow prevention included. System programming and training provided. 12-month warranty on installation.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'landscaping-retaining-wall',
    name: 'Retaining Wall Construction Job',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Retaining Wall Construction',
      description: 'Build timber sleeper, concrete block, or boulder retaining walls with proper drainage.',
      terms: 'Engineering certification if over 500mm high. Drainage system included. Compliant with NCC requirements. Council permits arranged if required. 12-month structural guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'landscaping-paving',
    name: 'Paving Installation Job',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Paving & Pathway Installation',
      description: 'Install pavers, flagstones, or concrete pathways with proper base preparation and edging.',
      terms: 'Base preparation and compaction included. Variety of paver styles available. Edge restraints installed. Sealing available. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'landscaping-tree-removal',
    name: 'Tree Removal & Pruning Job',
    tradeType: 'landscaping',
    styling: {
      brandColor: '#16a34a',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Tree Removal & Pruning',
      description: 'Professional tree removal, pruning, and stump grinding by qualified arborists.',
      terms: 'Council permit responsibility of property owner. Fully insured. Debris removal and site clean-up included. Stump grinding available. Mulch available on request.'
    },
    defaultLineItems: []
  },

  // ROOFING JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'roofing-repair',
    name: 'Roof Repair Job',
    tradeType: 'roofing',
    styling: {
      brandColor: '#78350f',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Roof Repair',
      description: 'Repair damaged, cracked, or missing roof tiles and metal sheets to prevent leaks.',
      terms: 'Licensed roof plumber. Height safety compliant. Weather-dependent work. Matching tiles sourced where possible. 12-month leak-free guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'roofing-restoration',
    name: 'Roof Restoration Job',
    tradeType: 'roofing',
    styling: {
      brandColor: '#78350f',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Roof Restoration',
      description: 'Complete roof restoration including cleaning, repairs, repointing, and protective coating.',
      terms: 'High-pressure cleaning included. Ridge cap repointing. Broken tiles replaced. Premium roof paint/coating applied. 10-year coating warranty. Height safety compliant.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'roofing-gutter-install',
    name: 'Gutter Installation Job',
    tradeType: 'roofing',
    styling: {
      brandColor: '#78350f',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Gutter & Downpipe Installation',
      description: 'Supply and install new gutters, downpipes, and leaf guard systems.',
      terms: 'Licensed roof plumber. Colorbond colour matching. Old gutter removal and disposal. Correct fall for drainage. 15-year material warranty on Colorbond.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'roofing-gutter-clean',
    name: 'Gutter Cleaning Job',
    tradeType: 'roofing',
    styling: {
      brandColor: '#78350f',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Gutter Cleaning Service',
      description: 'Clean gutters and downpipes of leaves, debris, and blockages to prevent water damage.',
      terms: 'All debris removed from site. Downpipes flushed. Minor repairs included. Before and after photos available. Recommended twice yearly.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'roofing-metal-reroof',
    name: 'Metal Roof Installation Job',
    tradeType: 'roofing',
    styling: {
      brandColor: '#78350f',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Metal Roof Installation',
      description: 'Remove old roof and install new Colorbond or Zincalume metal roofing with insulation.',
      terms: 'Licensed roof plumber. Compliant with NCC/BCA. Includes sarking/insulation. 25-year Colorbond warranty. Asbestos removal arranged separately if required.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'roofing-skylight',
    name: 'Skylight Installation Job',
    tradeType: 'roofing',
    styling: {
      brandColor: '#78350f',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Skylight Installation',
      description: 'Supply and install skylights including tubular and flat glass options with flashing.',
      terms: 'Compliant with NCC requirements. Weatherproof flashing system. Ceiling work by licensed plasterer. 10-year manufacturer warranty. Reduces energy costs.'
    },
    defaultLineItems: []
  },

  // TILING JOB TEMPLATES
  {
    type: 'job',
    familyKey: 'tiling-bathroom',
    name: 'Bathroom Tiling Job',
    tradeType: 'tiling',
    styling: {
      brandColor: '#0891b2',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Bathroom Tiling',
      description: 'Supply and install floor and wall tiles for bathroom renovations with waterproofing.',
      terms: 'Waterproofing by licensed applicator. Compliant with AS 3740. Premium adhesives and grout. Tile supplied by client or sourced to order. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'tiling-kitchen-splashback',
    name: 'Kitchen Splashback Tiling Job',
    tradeType: 'tiling',
    styling: {
      brandColor: '#0891b2',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Kitchen Splashback Tiling',
      description: 'Install decorative or functional tile splashback behind benchtops and cooktops.',
      terms: 'Surface preparation included. Heat-resistant adhesive near cooktop. Grout colour matching available. Clean-up included. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'tiling-floor',
    name: 'Floor Tiling Job',
    tradeType: 'tiling',
    styling: {
      brandColor: '#0891b2',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Floor Tiling Installation',
      description: 'Install floor tiles for living areas, kitchens, and entrances with optional underfloor heating.',
      terms: 'Floor levelling if required at additional cost. Expansion joints included. Anti-slip options for wet areas. Furniture moving not included. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'tiling-outdoor',
    name: 'Outdoor Tiling Job',
    tradeType: 'tiling',
    styling: {
      brandColor: '#0891b2',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Outdoor Tiling',
      description: 'Install outdoor tiles for patios, balconies, and pool surrounds with appropriate drainage.',
      terms: 'Frost-resistant and slip-resistant tiles required. External grade adhesive and grout. Drainage fall maintained. Pool-safe options available. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'tiling-repair',
    name: 'Tile Repair & Replacement Job',
    tradeType: 'tiling',
    styling: {
      brandColor: '#0891b2',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Tile Repair & Replacement',
      description: 'Remove and replace cracked, chipped, or hollow tiles with colour-matched replacements.',
      terms: 'Matching tiles sourced where possible. Grout colour matching. Underlying issues assessed. Waterproofing check in wet areas. 12-month workmanship guarantee.'
    },
    defaultLineItems: []
  },
  {
    type: 'job',
    familyKey: 'tiling-waterproofing',
    name: 'Waterproofing & Tiling Job',
    tradeType: 'tiling',
    styling: {
      brandColor: '#0891b2',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: false,
      showTotals: false,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Waterproofing & Tiling',
      description: 'Complete waterproofing membrane application and tiling for bathrooms, laundries, and wet areas.',
      terms: 'Licensed waterproofer. Compliant with AS 3740. Waterproofing certificate provided. Membrane inspection prior to tiling. 7-year waterproofing guarantee.'
    },
    defaultLineItems: []
  },

  // INVOICE TEMPLATES (Multiple varieties)
  {
    type: 'invoice',
    familyKey: 'plumbing-completed',
    name: 'Plumbing Work Completed Invoice',
    tradeType: 'plumbing',
    styling: {
      brandColor: '#2563eb',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Plumbing Services Invoice',
      description: 'Professional plumbing work completed as quoted',
      terms: 'Payment due within 30 days. Direct deposit preferred. All work guaranteed for 12 months. Thank you for your business.',
      depositPct: 0,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Plumbing services as per quote',
        qty: 1,
        unitPrice: 0.00,
        unit: 'job'
      }
    ]
  },
  {
    type: 'invoice',
    familyKey: 'electrical-completed',
    name: 'Electrical Work Completed Invoice',
    tradeType: 'electrical',
    styling: {
      brandColor: '#dc2626',
      logoDisplay: true
    },
    sections: {
      showHeader: true,
      showLineItems: true,
      showTotals: true,
      showTerms: true,
      showSignature: false
    },
    defaults: {
      title: 'Electrical Services Invoice',
      description: 'Licensed electrical work completed with certification',
      terms: 'Payment due within 30 days. Electrical safety certificate attached. All work guaranteed for 12 months. AS/NZS 3000:2018 compliant.',
      depositPct: 0,
      dueTermDays: 30,
      gstEnabled: true
    },
    defaultLineItems: [
      {
        description: 'Electrical services as per quote',
        qty: 1,
        unitPrice: 0.00,
        unit: 'job'
      }
    ]
  }
];

// Enhanced line item catalog with much more variety
export const tradieLineItems = [
  // Plumbing Line Items
  { tradeType: 'plumbing', name: 'Drain clearing - basic', description: 'Clear blocked drain with water jetter', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Drain clearing - heavy duty', description: 'Clear severe blockage with electric eel', unit: 'each', unitPrice: 280.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Tap replacement - standard', description: 'Supply and install standard tap', unit: 'each', unitPrice: 220.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Tap replacement - premium', description: 'Supply and install premium mixer tap', unit: 'each', unitPrice: 380.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Toilet repair', description: 'Repair toilet cistern and fittings', unit: 'each', unitPrice: 160.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Toilet replacement', description: 'Supply and install new toilet suite', unit: 'each', unitPrice: 520.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Hot water service - electric', description: 'Supply and install 315L electric hot water system', unit: 'each', unitPrice: 1400.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Hot water service - gas', description: 'Supply and install gas hot water system', unit: 'each', unitPrice: 1600.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Pipe repair - copper', description: 'Repair copper water pipe', unit: 'metre', unitPrice: 45.00, defaultQty: 1 },
  { tradeType: 'plumbing', name: 'Pipe installation - PEX', description: 'Install new PEX water pipe', unit: 'metre', unitPrice: 35.00, defaultQty: 1 },

  // Electrical Line Items  
  { tradeType: 'electrical', name: 'Power point installation', description: 'Install new GPO power point', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Light fitting installation', description: 'Install standard light fitting', unit: 'each', unitPrice: 120.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Ceiling fan installation', description: 'Supply and install ceiling fan with light', unit: 'each', unitPrice: 280.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Safety switch installation', description: 'Install RCD safety switch', unit: 'each', unitPrice: 220.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Switchboard upgrade', description: 'Replace old switchboard with modern unit', unit: 'each', unitPrice: 1200.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Smoke alarm installation', description: 'Install 10-year lithium smoke alarm', unit: 'each', unitPrice: 150.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'Data point installation', description: 'Install Cat6 data point', unit: 'each', unitPrice: 160.00, defaultQty: 1 },
  { tradeType: 'electrical', name: 'External lighting', description: 'Install outdoor security light with sensor', unit: 'each', unitPrice: 200.00, defaultQty: 1 },

  // Carpentry Line Items
  { tradeType: 'carpentry', name: 'Deck construction - treated pine', description: 'Construct timber deck with treated pine', unit: 'sqm', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Deck construction - hardwood', description: 'Construct hardwood timber deck', unit: 'sqm', unitPrice: 280.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Kitchen cabinet - base unit', description: 'Custom base kitchen cabinet', unit: 'lineal metre', unitPrice: 800.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Kitchen cabinet - wall unit', description: 'Custom wall kitchen cabinet', unit: 'lineal metre', unitPrice: 650.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Door hanging - standard', description: 'Hang new interior door', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Door hanging - external', description: 'Hang new external door with hardware', unit: 'each', unitPrice: 350.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Window installation', description: 'Install new window frame', unit: 'each', unitPrice: 450.00, defaultQty: 1 },
  { tradeType: 'carpentry', name: 'Pergola construction', description: 'Build timber pergola structure', unit: 'sqm', unitPrice: 220.00, defaultQty: 1 },

  // HVAC Line Items
  { tradeType: 'hvac', name: 'Split system - 7kW', description: 'Supply and install 7kW split system', unit: 'each', unitPrice: 2800.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Split system - 12kW', description: 'Supply and install 12kW split system', unit: 'each', unitPrice: 3800.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Ducted system - residential', description: 'Supply and install ducted system', unit: 'each', unitPrice: 8500.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Service call - standard', description: 'Standard HVAC service and clean', unit: 'each', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Service call - comprehensive', description: 'Full system service and gas check', unit: 'each', unitPrice: 280.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Gas leak repair', description: 'Locate and repair refrigerant gas leak', unit: 'each', unitPrice: 380.00, defaultQty: 1 },
  { tradeType: 'hvac', name: 'Thermostat upgrade', description: 'Install programmable thermostat', unit: 'each', unitPrice: 250.00, defaultQty: 1 },

  // Painting Line Items
  { tradeType: 'painting', name: 'Interior painting - standard', description: 'Paint interior walls (2 coats)', unit: 'sqm', unitPrice: 22.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Interior painting - premium', description: 'Paint interior walls with premium paint', unit: 'sqm', unitPrice: 28.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Exterior painting - weatherboard', description: 'Paint exterior weatherboard walls', unit: 'sqm', unitPrice: 32.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Exterior painting - render', description: 'Paint exterior render walls', unit: 'sqm', unitPrice: 26.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Ceiling painting', description: 'Paint ceiling (2 coats)', unit: 'sqm', unitPrice: 18.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'Trim and doors', description: 'Paint trim, architraves and doors', unit: 'lineal metre', unitPrice: 25.00, defaultQty: 1 },
  { tradeType: 'painting', name: 'High-pressure cleaning', description: 'Clean surfaces before painting', unit: 'sqm', unitPrice: 12.00, defaultQty: 1 },

  // Landscaping Line Items
  { tradeType: 'landscaping', name: 'Lawn installation - buffalo', description: 'Supply and install buffalo turf', unit: 'sqm', unitPrice: 18.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Lawn installation - couch', description: 'Supply and install couch grass', unit: 'sqm', unitPrice: 15.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Garden bed preparation', description: 'Prepare garden bed with soil improvement', unit: 'sqm', unitPrice: 25.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Plant installation - shrubs', description: 'Supply and plant native shrubs', unit: 'each', unitPrice: 35.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Plant installation - trees', description: 'Supply and plant established trees', unit: 'each', unitPrice: 150.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Mulching', description: 'Apply organic mulch to garden beds', unit: 'sqm', unitPrice: 8.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Irrigation installation', description: 'Install drip irrigation system', unit: 'sqm', unitPrice: 28.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Retaining wall - timber', description: 'Build timber retaining wall', unit: 'lineal metre', unitPrice: 180.00, defaultQty: 1 },
  { tradeType: 'landscaping', name: 'Retaining wall - block', description: 'Build block retaining wall', unit: 'lineal metre', unitPrice: 250.00, defaultQty: 1 }
];

// Enhanced rate cards for each trade
export const tradieRateCards = [
  {
    name: 'Plumbing - Standard Rate',
    tradeType: 'plumbing',
    hourlyRate: 120.00,
    calloutFee: 80.00,
    materialMarkupPct: 25.00,
    afterHoursMultiplier: 1.50,
    gstEnabled: true
  },
  {
    name: 'Plumbing - Emergency Rate',
    tradeType: 'plumbing',
    hourlyRate: 180.00,
    calloutFee: 120.00,
    materialMarkupPct: 25.00,
    afterHoursMultiplier: 2.00,
    gstEnabled: true
  },
  {
    name: 'Electrical - Standard Rate',
    tradeType: 'electrical',
    hourlyRate: 135.00,
    calloutFee: 90.00,
    materialMarkupPct: 30.00,
    afterHoursMultiplier: 1.75,
    gstEnabled: true
  },
  {
    name: 'Electrical - Commercial Rate',
    tradeType: 'electrical',
    hourlyRate: 150.00,
    calloutFee: 120.00,
    materialMarkupPct: 25.00,
    afterHoursMultiplier: 1.50,
    gstEnabled: true
  },
  {
    name: 'Carpentry - Standard Rate',
    tradeType: 'carpentry',
    hourlyRate: 110.00,
    calloutFee: 60.00,
    materialMarkupPct: 35.00,
    afterHoursMultiplier: 1.25,
    gstEnabled: true
  },
  {
    name: 'Carpentry - Custom Work Rate',
    tradeType: 'carpentry',
    hourlyRate: 140.00,
    calloutFee: 80.00,
    materialMarkupPct: 40.00,
    afterHoursMultiplier: 1.50,
    gstEnabled: true
  },
  {
    name: 'HVAC - Standard Rate',
    tradeType: 'hvac',
    hourlyRate: 140.00,
    calloutFee: 100.00,
    materialMarkupPct: 20.00,
    afterHoursMultiplier: 1.75,
    gstEnabled: true
  },
  {
    name: 'HVAC - Commercial Rate',
    tradeType: 'hvac',
    hourlyRate: 160.00,
    calloutFee: 150.00,
    materialMarkupPct: 15.00,
    afterHoursMultiplier: 1.50,
    gstEnabled: true
  },
  {
    name: 'Painting - Standard Rate',
    tradeType: 'painting',
    hourlyRate: 95.00,
    calloutFee: 50.00,
    materialMarkupPct: 25.00,
    afterHoursMultiplier: 1.25,
    gstEnabled: true
  },
  {
    name: 'Painting - Commercial Rate',
    tradeType: 'painting',
    hourlyRate: 110.00,
    calloutFee: 80.00,
    materialMarkupPct: 20.00,
    afterHoursMultiplier: 1.50,
    gstEnabled: true
  },
  {
    name: 'Landscaping - Standard Rate',
    tradeType: 'landscaping',
    hourlyRate: 85.00,
    calloutFee: 60.00,
    materialMarkupPct: 40.00,
    afterHoursMultiplier: 1.25,
    gstEnabled: true
  },
  {
    name: 'Landscaping - Design Rate',
    tradeType: 'landscaping',
    hourlyRate: 120.00,
    calloutFee: 100.00,
    materialMarkupPct: 35.00,
    afterHoursMultiplier: 1.50,
    gstEnabled: true
  }
];