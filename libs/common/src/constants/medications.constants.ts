export const COMMON_MEDICATIONS = [
  // Analgesics & NSAIDs
  {
    name: 'Paracetamol',
    category: 'Analgesic',
    default_route: 'Oral',
    common_dosages: ['500mg', '1000mg'],
    isCommon: true,
  },
  {
    name: 'Aspirin',
    category: 'Analgesic / Antiplatelet',
    default_route: 'Oral',
    common_dosages: ['75mg', '150mg', '300mg'],
    isCommon: true,
  },
  {
    name: 'Ibuprofen',
    category: 'NSAID',
    default_route: 'Oral',
    common_dosages: ['200mg', '400mg'],
    isCommon: true,
  },
  {
    name: 'Morphine',
    category: 'Opioid Analgesic',
    default_route: 'IV',
    common_dosages: ['2.5mg', '5mg', '10mg'],
    isCommon: false,
  },
  {
    name: 'Fentanyl',
    category: 'Opioid Analgesic',
    default_route: 'IV',
    common_dosages: ['50mcg', '100mcg'],
    isCommon: false,
  },

  // Cardiac & Emergency
  {
    name: 'Adrenaline (Epinephrine)',
    category: 'Sympathomimetic',
    default_route: 'IM / IV',
    common_dosages: ['0.3mg', '0.5mg', '1mg'],
    isCommon: true,
  },
  {
    name: 'Atropine',
    category: 'Anticholinergic',
    default_route: 'IV',
    common_dosages: ['0.5mg', '1mg'],
    isCommon: true,
  },
  {
    name: 'Amiodarone',
    category: 'Antiarrhythmic',
    default_route: 'IV',
    common_dosages: ['150mg', '300mg'],
    isCommon: false,
  },
  {
    name: 'Nitroglycerin',
    category: 'Vasodilator',
    default_route: 'Sublingual',
    common_dosages: ['0.4mg'],
    isCommon: true,
  },
  {
    name: 'Furosemide (Lasix)',
    category: 'Diuretic',
    default_route: 'IV / Oral',
    common_dosages: ['20mg', '40mg'],
    isCommon: true,
  },

  // Respiratory
  {
    name: 'Salbutamol (Albuterol)',
    category: 'Bronchodilator',
    default_route: 'Inhalation',
    common_dosages: ['2.5mg', '5mg'],
    isCommon: true,
  },
  {
    name: 'Ipratropium',
    category: 'Anticholinergic',
    default_route: 'Inhalation',
    common_dosages: ['0.5mg'],
    isCommon: true,
  },
  {
    name: 'Hydrocortisone',
    category: 'Corticosteroid',
    default_route: 'IV',
    common_dosages: ['100mg'],
    isCommon: true,
  },

  // Anti-diabetics
  {
    name: 'Metformin',
    category: 'Biguanide',
    default_route: 'Oral',
    common_dosages: ['500mg', '1000mg'],
    isCommon: true,
  },
  {
    name: 'Glimepiride',
    category: 'Sulfonylurea',
    default_route: 'Oral',
    common_dosages: ['1mg', '2mg'],
    isCommon: true,
  },
  {
    name: 'Insulin (Regular)',
    category: 'Insulin',
    default_route: 'Subcutaneous',
    common_dosages: ['Variable'],
    isCommon: true,
  },

  // Antibiotics
  {
    name: 'Amoxicillin',
    category: 'Antibiotic',
    default_route: 'Oral',
    common_dosages: ['250mg', '500mg'],
    isCommon: true,
  },
  {
    name: 'Ceftriaxone',
    category: 'Antibiotic',
    default_route: 'IV',
    common_dosages: ['1g', '2g'],
    isCommon: false,
  },
  {
    name: 'Azithromycin',
    category: 'Antibiotic',
    default_route: 'Oral',
    common_dosages: ['250mg', '500mg'],
    isCommon: true,
  },

  // Gastrointestinal
  {
    name: 'Ondansetron',
    category: 'Antiemetic',
    default_route: 'IV / Oral',
    common_dosages: ['4mg', '8mg'],
    isCommon: true,
  },
  {
    name: 'Pantoprazole',
    category: 'Proton Pump Inhibitor',
    default_route: 'IV / Oral',
    common_dosages: ['40mg'],
    isCommon: true,
  },
  {
    name: 'Metoclopramide',
    category: 'Antiemetic',
    default_route: 'IV / Oral',
    common_dosages: ['10mg'],
    isCommon: true,
  },
];
