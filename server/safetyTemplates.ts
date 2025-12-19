export const SAFETY_FORM_TEMPLATES = {
  swms: {
    name: 'Safe Work Method Statement (SWMS)',
    description: 'Australian standard SWMS template for high-risk construction work. Required under WHS regulations.',
    formType: 'safety',
    requiresSignature: true,
    fields: [
      { id: 'company_name', type: 'text', label: 'Company/Business Name', required: true },
      { id: 'abn', type: 'text', label: 'ABN', required: false },
      { id: 'project_name', type: 'text', label: 'Project/Job Name', required: true },
      { id: 'site_address', type: 'text', label: 'Site Address', required: true },
      { id: 'work_description', type: 'textarea', label: 'Description of Work Activity', required: true },
      { id: 'start_date', type: 'date', label: 'Start Date', required: true },
      { id: 'end_date', type: 'date', label: 'Expected Completion Date', required: false },
      { id: 'principal_contractor', type: 'text', label: 'Principal Contractor (if applicable)', required: false },
      {
        id: 'hazards_section',
        type: 'section',
        label: 'HAZARD IDENTIFICATION & RISK CONTROL',
        description: 'Identify all hazards associated with this work activity'
      },
      {
        id: 'hazards',
        type: 'checklist',
        label: 'Potential Hazards',
        options: [
          'Working at heights (above 2m)',
          'Electrical work/live services',
          'Excavation/trenching',
          'Hot work (welding/grinding)',
          'Confined spaces',
          'Manual handling/heavy lifting',
          'Working with asbestos',
          'Exposure to hazardous chemicals',
          'Mobile plant/machinery',
          'Traffic management',
          'Noise exposure',
          'Working in extreme temperatures',
          'Working near water',
          'Falling objects',
          'Slips, trips and falls',
          'Underground services'
        ],
        required: true
      },
      {
        id: 'control_measures',
        type: 'textarea',
        label: 'Control Measures to Eliminate/Minimise Risks',
        placeholder: 'List all control measures that will be implemented...',
        required: true
      },
      {
        id: 'ppe_section',
        type: 'section',
        label: 'PERSONAL PROTECTIVE EQUIPMENT (PPE)'
      },
      {
        id: 'ppe_required',
        type: 'checklist',
        label: 'PPE Required for this Work',
        options: [
          'Hard hat',
          'Safety glasses/goggles',
          'High visibility vest',
          'Steel cap boots',
          'Gloves (specify type)',
          'Hearing protection',
          'Dust mask/respirator',
          'Face shield',
          'Fall protection harness',
          'Sun protection'
        ],
        required: true
      },
      {
        id: 'emergency_section',
        type: 'section',
        label: 'EMERGENCY PROCEDURES'
      },
      { id: 'emergency_contact', type: 'text', label: 'Emergency Contact Name', required: true },
      { id: 'emergency_phone', type: 'tel', label: 'Emergency Phone Number', required: true },
      { id: 'first_aid_location', type: 'text', label: 'First Aid Kit Location', required: true },
      { id: 'assembly_point', type: 'text', label: 'Emergency Assembly Point', required: true },
      {
        id: 'consultation_section',
        type: 'section',
        label: 'WORKER CONSULTATION & SIGN-OFF',
        description: 'All workers must read, understand and sign this SWMS before commencing work'
      },
      { id: 'prepared_by', type: 'text', label: 'SWMS Prepared By', required: true },
      { id: 'prepared_date', type: 'date', label: 'Date Prepared', required: true },
      { id: 'reviewed_by', type: 'text', label: 'Reviewed By (Supervisor)', required: false },
      { id: 'worker_acknowledgement', type: 'checkbox', label: 'I have read and understood this SWMS and agree to follow all control measures', required: true }
    ],
    settings: {
      showLogo: true,
      includeWeatherConditions: true,
      autoPopulateFromJob: true
    }
  },

  jsa: {
    name: 'Job Safety Analysis (JSA)',
    description: 'Step-by-step safety analysis for job tasks. Identify hazards and controls for each step of the work.',
    formType: 'safety',
    requiresSignature: true,
    fields: [
      { id: 'job_title', type: 'text', label: 'Job/Task Title', required: true },
      { id: 'location', type: 'text', label: 'Location', required: true },
      { id: 'date', type: 'date', label: 'Date', required: true },
      { id: 'supervisor', type: 'text', label: 'Supervisor Name', required: true },
      {
        id: 'pre_start_section',
        type: 'section',
        label: 'PRE-START CHECKS'
      },
      {
        id: 'pre_start_checks',
        type: 'checklist',
        label: 'Pre-Start Safety Checks',
        options: [
          'Site induction completed',
          'Work area inspected and safe',
          'Tools and equipment checked',
          'PPE available and in good condition',
          'Permits obtained (if required)',
          'Workers briefed on hazards',
          'Emergency procedures known',
          'Weather conditions acceptable'
        ],
        required: true
      },
      {
        id: 'task_steps_section',
        type: 'section',
        label: 'TASK BREAKDOWN',
        description: 'Break down the job into steps and identify hazards for each step'
      },
      {
        id: 'step_1',
        type: 'group',
        label: 'Step 1',
        fields: [
          { id: 'step_1_task', type: 'text', label: 'Task/Activity', required: true },
          { id: 'step_1_hazards', type: 'textarea', label: 'Hazards Identified', required: true },
          { id: 'step_1_controls', type: 'textarea', label: 'Control Measures', required: true },
          { id: 'step_1_responsible', type: 'text', label: 'Person Responsible', required: false }
        ]
      },
      {
        id: 'step_2',
        type: 'group',
        label: 'Step 2',
        fields: [
          { id: 'step_2_task', type: 'text', label: 'Task/Activity', required: false },
          { id: 'step_2_hazards', type: 'textarea', label: 'Hazards Identified', required: false },
          { id: 'step_2_controls', type: 'textarea', label: 'Control Measures', required: false },
          { id: 'step_2_responsible', type: 'text', label: 'Person Responsible', required: false }
        ]
      },
      {
        id: 'step_3',
        type: 'group',
        label: 'Step 3',
        fields: [
          { id: 'step_3_task', type: 'text', label: 'Task/Activity', required: false },
          { id: 'step_3_hazards', type: 'textarea', label: 'Hazards Identified', required: false },
          { id: 'step_3_controls', type: 'textarea', label: 'Control Measures', required: false },
          { id: 'step_3_responsible', type: 'text', label: 'Person Responsible', required: false }
        ]
      },
      {
        id: 'additional_notes',
        type: 'textarea',
        label: 'Additional Safety Notes',
        required: false
      },
      {
        id: 'sign_off_section',
        type: 'section',
        label: 'SIGN-OFF'
      },
      { id: 'worker_name', type: 'text', label: 'Worker Name', required: true },
      { id: 'worker_acknowledgement', type: 'checkbox', label: 'I understand the hazards and will follow all control measures', required: true }
    ],
    settings: {
      showLogo: true,
      autoPopulateFromJob: true
    }
  },

  toolbox_talk: {
    name: 'Toolbox Talk Record',
    description: 'Record of safety briefing/toolbox talk conducted with workers before starting work.',
    formType: 'safety',
    requiresSignature: true,
    fields: [
      { id: 'date', type: 'date', label: 'Date', required: true },
      { id: 'time', type: 'time', label: 'Time', required: true },
      { id: 'location', type: 'text', label: 'Location', required: true },
      { id: 'conducted_by', type: 'text', label: 'Conducted By', required: true },
      {
        id: 'topics_section',
        type: 'section',
        label: 'TOPICS DISCUSSED'
      },
      {
        id: 'topics',
        type: 'checklist',
        label: 'Safety Topics Covered',
        options: [
          'Site hazards and risks',
          'PPE requirements',
          'Emergency procedures',
          'First aid locations',
          'Hot work permits',
          'Working at heights',
          'Manual handling',
          'Electrical safety',
          'Traffic management',
          'Weather conditions',
          'Incident reporting',
          'Housekeeping'
        ],
        required: true
      },
      { id: 'other_topics', type: 'textarea', label: 'Other Topics/Issues Discussed', required: false },
      { id: 'actions_required', type: 'textarea', label: 'Actions Required', required: false },
      {
        id: 'attendees_section',
        type: 'section',
        label: 'ATTENDEES',
        description: 'All workers present must sign to confirm attendance'
      },
      { id: 'attendee_count', type: 'number', label: 'Number of Attendees', required: true },
      { id: 'attendee_acknowledgement', type: 'checkbox', label: 'I attended this toolbox talk and understood the safety information presented', required: true }
    ],
    settings: {
      showLogo: true,
      multipleSignatures: true
    }
  },

  site_inspection: {
    name: 'Site Safety Inspection',
    description: 'Regular site safety inspection checklist to identify hazards and ensure compliance.',
    formType: 'inspection',
    requiresSignature: true,
    fields: [
      { id: 'site_name', type: 'text', label: 'Site/Project Name', required: true },
      { id: 'inspection_date', type: 'date', label: 'Inspection Date', required: true },
      { id: 'inspector_name', type: 'text', label: 'Inspector Name', required: true },
      { id: 'weather', type: 'select', label: 'Weather Conditions', options: ['Clear', 'Cloudy', 'Rain', 'Hot (>35°C)', 'Cold (<10°C)', 'Windy'], required: true },
      {
        id: 'housekeeping_section',
        type: 'section',
        label: 'HOUSEKEEPING'
      },
      {
        id: 'housekeeping',
        type: 'rating_checklist',
        label: 'Housekeeping Items',
        items: [
          'Work areas clean and tidy',
          'Walkways clear of obstructions',
          'Waste disposed of properly',
          'Materials stored safely',
          'Tools stored correctly'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'ppe_section',
        type: 'section',
        label: 'PPE COMPLIANCE'
      },
      {
        id: 'ppe_compliance',
        type: 'rating_checklist',
        label: 'PPE Items',
        items: [
          'Hard hats worn correctly',
          'Safety footwear worn',
          'Hi-vis vests worn',
          'Eye protection used where required',
          'Hearing protection used where required',
          'Gloves used where required'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'electrical_section',
        type: 'section',
        label: 'ELECTRICAL SAFETY'
      },
      {
        id: 'electrical',
        type: 'rating_checklist',
        label: 'Electrical Items',
        items: [
          'Power leads in good condition',
          'RCDs tested and tagged',
          'Tools tested and tagged',
          'Switchboards secured',
          'No exposed wiring'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'heights_section',
        type: 'section',
        label: 'WORKING AT HEIGHTS'
      },
      {
        id: 'heights',
        type: 'rating_checklist',
        label: 'Heights Safety Items',
        items: [
          'Scaffolding tagged and inspected',
          'Guardrails in place',
          'Ladders secured and in good condition',
          'Fall protection equipment available',
          'Edge protection in place'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      {
        id: 'emergency_section',
        type: 'section',
        label: 'EMERGENCY PREPAREDNESS'
      },
      {
        id: 'emergency',
        type: 'rating_checklist',
        label: 'Emergency Items',
        items: [
          'First aid kit stocked and accessible',
          'Emergency exits clear',
          'Fire extinguisher accessible',
          'Emergency contacts displayed',
          'Evacuation plan displayed'
        ],
        ratingOptions: ['Satisfactory', 'Needs Improvement', 'Unsatisfactory', 'N/A']
      },
      { id: 'hazards_found', type: 'textarea', label: 'Hazards/Issues Identified', required: false },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions Required', required: false },
      { id: 'follow_up_date', type: 'date', label: 'Follow-up Date', required: false },
      { id: 'overall_rating', type: 'select', label: 'Overall Site Rating', options: ['Excellent', 'Good', 'Satisfactory', 'Needs Improvement', 'Unsatisfactory'], required: true }
    ],
    settings: {
      showLogo: true,
      generatePdfReport: true
    }
  },

  incident_report: {
    name: 'Incident/Near Miss Report',
    description: 'Report workplace incidents, injuries, or near misses as required by WHS regulations.',
    formType: 'compliance',
    requiresSignature: true,
    fields: [
      {
        id: 'incident_type_section',
        type: 'section',
        label: 'INCIDENT CLASSIFICATION'
      },
      {
        id: 'incident_type',
        type: 'select',
        label: 'Type of Incident',
        options: ['Injury/Illness', 'Near Miss', 'Property Damage', 'Environmental Incident', 'Vehicle Incident'],
        required: true
      },
      {
        id: 'severity',
        type: 'select',
        label: 'Severity',
        options: ['Minor (First Aid)', 'Moderate (Medical Treatment)', 'Serious (Lost Time)', 'Critical (Notifiable)'],
        required: true
      },
      {
        id: 'details_section',
        type: 'section',
        label: 'INCIDENT DETAILS'
      },
      { id: 'incident_date', type: 'date', label: 'Date of Incident', required: true },
      { id: 'incident_time', type: 'time', label: 'Time of Incident', required: true },
      { id: 'location', type: 'text', label: 'Location of Incident', required: true },
      { id: 'description', type: 'textarea', label: 'Description of Incident', placeholder: 'Describe what happened in detail...', required: true },
      {
        id: 'person_section',
        type: 'section',
        label: 'PERSON(S) INVOLVED'
      },
      { id: 'injured_name', type: 'text', label: 'Name of Injured Person (if applicable)', required: false },
      { id: 'injury_type', type: 'text', label: 'Type of Injury', required: false },
      { id: 'treatment', type: 'textarea', label: 'Treatment Provided', required: false },
      {
        id: 'investigation_section',
        type: 'section',
        label: 'INVESTIGATION'
      },
      { id: 'immediate_cause', type: 'textarea', label: 'Immediate Cause', required: true },
      { id: 'underlying_cause', type: 'textarea', label: 'Underlying/Root Cause', required: false },
      { id: 'corrective_actions', type: 'textarea', label: 'Corrective Actions to Prevent Recurrence', required: true },
      { id: 'action_owner', type: 'text', label: 'Action Owner', required: true },
      { id: 'completion_date', type: 'date', label: 'Target Completion Date', required: true },
      {
        id: 'reporting_section',
        type: 'section',
        label: 'REPORTING'
      },
      { id: 'reported_to_regulator', type: 'checkbox', label: 'Reported to WorkSafe (if notifiable)', required: false },
      { id: 'reported_by', type: 'text', label: 'Report Completed By', required: true },
      { id: 'report_date', type: 'date', label: 'Date of Report', required: true }
    ],
    settings: {
      showLogo: true,
      notifyOwner: true,
      generatePdfReport: true
    }
  }
};

export type SafetyFormTemplateKey = keyof typeof SAFETY_FORM_TEMPLATES;

export function getSafetyFormTemplates() {
  return Object.entries(SAFETY_FORM_TEMPLATES).map(([key, template]) => ({
    templateKey: key,
    ...template,
    isSystemTemplate: true
  }));
}

export function getSafetyFormTemplate(key: SafetyFormTemplateKey) {
  const template = SAFETY_FORM_TEMPLATES[key];
  if (!template) return null;
  return {
    templateKey: key,
    ...template,
    isSystemTemplate: true
  };
}
