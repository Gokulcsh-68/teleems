export const COMMON_CHIEF_COMPLAINTS = [
  // Medical - Cardiac
  {
    name: 'Chest Pain',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Palpitations',
    category: 'Medical',
    default_triage: 'YELLOW',
    isCommon: true,
  },
  {
    name: 'Syncope (Fainting)',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },

  // Medical - Respiratory
  {
    name: 'Shortness of Breath',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Choking',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Severe Cough',
    category: 'Medical',
    default_triage: 'YELLOW',
    isCommon: true,
  },

  // Medical - Neurological
  {
    name: 'Altered Mental Status',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Seizures',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Severe Headache',
    category: 'Medical',
    default_triage: 'YELLOW',
    isCommon: true,
  },
  {
    name: 'Stroke Symptoms (Weakness/Speech)',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },

  // Medical - General
  {
    name: 'Abdominal Pain',
    category: 'Medical',
    default_triage: 'YELLOW',
    isCommon: true,
  },
  {
    name: 'High Fever',
    category: 'Medical',
    default_triage: 'YELLOW',
    isCommon: true,
  },
  {
    name: 'Allergic Reaction',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Diabetic Emergency',
    category: 'Medical',
    default_triage: 'RED',
    isCommon: true,
  },

  // Trauma
  {
    name: 'Road Traffic Accident',
    category: 'Trauma',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Fall from Height',
    category: 'Trauma',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Penetrating Injury (Stab/Gunshot)',
    category: 'Trauma',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Blunt Trauma',
    category: 'Trauma',
    default_triage: 'YELLOW',
    isCommon: true,
  },
  {
    name: 'Heavy Bleeding',
    category: 'Trauma',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Fracture / Dislocation',
    category: 'Trauma',
    default_triage: 'YELLOW',
    isCommon: true,
  },
  {
    name: 'Burn Injury',
    category: 'Trauma',
    default_triage: 'RED',
    isCommon: true,
  },

  // OB/GYN & Pediatrics
  {
    name: 'Active Labour',
    category: 'OB/GYN',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Vaginal Bleeding (Pregnancy)',
    category: 'OB/GYN',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Paediatric Respiratory Distress',
    category: 'Pediatrics',
    default_triage: 'RED',
    isCommon: true,
  },
  {
    name: 'Paediatric Seizure',
    category: 'Pediatrics',
    default_triage: 'RED',
    isCommon: true,
  },
];

export const COMMON_INTERVENTIONS = [
  // Airway & Breathing
  {
    name: 'Oxygen Therapy',
    category: 'Airway',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'BVM Ventilation',
    category: 'Airway',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Endotracheal Intubation',
    category: 'Airway',
    requires_specialized_logging: true,
    isCommon: true,
  },
  {
    name: 'LMA Insertion',
    category: 'Airway',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Suctioning',
    category: 'Airway',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Nebulization',
    category: 'Airway',
    requires_specialized_logging: false,
    isCommon: true,
  },

  // Cardiac
  {
    name: 'CPR (Cardiopulmonary Resuscitation)',
    category: 'Cardiac',
    requires_specialized_logging: true,
    isCommon: true,
  },
  {
    name: 'Defibrillation',
    category: 'Cardiac',
    requires_specialized_logging: true,
    isCommon: true,
  },
  {
    name: 'ECG - 12 Lead',
    category: 'Cardiac',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Cardiac Monitoring',
    category: 'Cardiac',
    requires_specialized_logging: false,
    isCommon: true,
  },

  // Vascular & Fluid
  {
    name: 'IV Cannulation',
    category: 'Vascular',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'IO Access',
    category: 'Vascular',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Fluid Bolus',
    category: 'Vascular',
    requires_specialized_logging: false,
    isCommon: true,
  },

  // Trauma & Wound
  {
    name: 'Wound Dressing / Bandaging',
    category: 'Trauma',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Splinting / Immobilization',
    category: 'Trauma',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Cervical Collar Application',
    category: 'Trauma',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Tourniquet Application',
    category: 'Trauma',
    requires_specialized_logging: false,
    isCommon: true,
  },
  {
    name: 'Spinal Boarding',
    category: 'Trauma',
    requires_specialized_logging: false,
    isCommon: true,
  },
];

export const COMMON_MEDICATION_ROUTES = [
  { name: 'IV (Intravenous)', code: 'IV', isCommon: true },
  { name: 'IM (Intramuscular)', code: 'IM', isCommon: true },
  { name: 'PO (Oral)', code: 'PO', isCommon: true },
  { name: 'SL (Sublingual)', code: 'SL', isCommon: true },
  { name: 'INH (Inhalation)', code: 'INH', isCommon: true },
  { name: 'NASAL (Intranasal)', code: 'NASAL', isCommon: true },
  { name: 'IO (Intraosseous)', code: 'IO', isCommon: true },
  { name: 'SC (Subcutaneous)', code: 'SC', isCommon: true },
];

export const COMMON_ACUTE_MEDICATIONS = [
  {
    name: 'Epinephrine (Adrenaline) 1:10000',
    category: 'Cardiac',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Amiodarone',
    category: 'Cardiac',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Atropine',
    category: 'Cardiac',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Fentanyl',
    category: 'Analgesic',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Morphine',
    category: 'Analgesic',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Naloxone',
    category: 'Antidote',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Midazolam',
    category: 'Sedative',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Salbutamol (Albuterol)',
    category: 'Respiratory',
    default_route: 'INH',
    isCommon: true,
  },
  {
    name: 'Aspirin (325mg)',
    category: 'Cardiac',
    default_route: 'PO',
    isCommon: true,
  },
  {
    name: 'Nitroglycerin',
    category: 'Cardiac',
    default_route: 'SL',
    isCommon: true,
  },
  {
    name: 'Dextrose 25%',
    category: 'Metabolic',
    default_route: 'IV',
    isCommon: true,
  },
  {
    name: 'Normal Saline (0.9% NaCl)',
    category: 'Fluid',
    default_route: 'IV',
    isCommon: true,
  },
];

export const COMMON_INCIDENT_CATEGORIES = [
  {
    id: 'IMMEDIATE',
    name: 'Immediate',
    description: 'Life-threatening injuries or illnesses requiring immediate intervention.',
    color_code: 'RED',
    hex_color: '#FF0000',
    isCommon: true,
  },
  {
    id: 'URGENT',
    name: 'Urgent',
    description: 'Serious but not immediately life-threatening conditions.',
    color_code: 'ORANGE',
    hex_color: '#FFA500',
    isCommon: true,
  },
  {
    id: 'DELAYED',
    name: 'Delayed',
    description: 'Non-life-threatening injuries that can wait for treatment.',
    color_code: 'GREEN',
    hex_color: '#008000',
    isCommon: true,
  },
  {
    id: 'MINIMAL',
    name: 'Minimal',
    description: 'Minor injuries requiring minimal care.',
    color_code: 'WHITE',
    hex_color: '#FFFFFF',
    isCommon: true,
  },
  {
    id: 'EXPECTANT',
    name: 'Expectant',
    description: 'Deceased or injuries so severe that survival is unlikely even with care.',
    color_code: 'BLACK',
    hex_color: '#000000',
    isCommon: true,
  },
  {
    id: 'IFT',
    name: 'Inter-facility Transfer',
    description: 'Transfer of patients between medical facilities.',
    color_code: 'BLUE',
    hex_color: '#0000FF',
    isCommon: true,
  },
  {
    id: 'MORTUARY',
    name: 'Mortuary Van',
    description: 'Transportation of deceased individuals.',
    color_code: 'GREY',
    hex_color: '#808080',
    isCommon: true,
  },
];
