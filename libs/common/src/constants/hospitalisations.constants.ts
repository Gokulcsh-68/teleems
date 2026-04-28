export const COMMON_HOSPITALISATION_REASONS = [
  // Respiratory
  { reason: 'Pneumonia', category: 'Respiratory', isCommon: true },
  { reason: 'Asthma Exacerbation', category: 'Respiratory', isCommon: true },
  { reason: 'COPD Exacerbation', category: 'Respiratory', isCommon: true },
  { reason: 'Pulmonary Embolism', category: 'Respiratory', isCommon: false },

  // Cardiovascular
  {
    reason: 'Myocardial Infarction (Heart Attack)',
    category: 'Cardiovascular',
    isCommon: true,
  },
  {
    reason: 'Congestive Heart Failure',
    category: 'Cardiovascular',
    isCommon: true,
  },
  { reason: 'Stroke / TIA', category: 'Cardiovascular', isCommon: true },
  {
    reason: 'Hypertensive Emergency',
    category: 'Cardiovascular',
    isCommon: true,
  },

  // Trauma
  {
    reason: 'Road Traffic Accident (Multiple Trauma)',
    category: 'Trauma',
    isCommon: true,
  },
  { reason: 'Fracture Repair', category: 'Trauma', isCommon: true },
  { reason: 'Head Injury / Concussion', category: 'Trauma', isCommon: true },
  { reason: 'Fall with Injury', category: 'Trauma', isCommon: true },

  // Infectious Disease
  {
    reason: 'Dengue Fever with Warning Signs',
    category: 'Infectious',
    isCommon: true,
  },
  { reason: 'Malaria', category: 'Infectious', isCommon: true },
  { reason: 'Sepsis / Septic Shock', category: 'Infectious', isCommon: true },
  { reason: 'Typhoid Fever', category: 'Infectious', isCommon: true },
  {
    reason: 'COVID-19 with Respiratory Distress',
    category: 'Infectious',
    isCommon: false,
  },

  // Gastrointestinal
  {
    reason: 'Acute Appendicitis',
    category: 'Gastrointestinal',
    isCommon: true,
  },
  {
    reason: 'Gastrointestinal Bleeding',
    category: 'Gastrointestinal',
    isCommon: true,
  },
  {
    reason: 'Acute Pancreatitis',
    category: 'Gastrointestinal',
    isCommon: false,
  },
  {
    reason: 'Severe Dehydration / GE',
    category: 'Gastrointestinal',
    isCommon: true,
  },

  // Neurology & Others
  {
    reason: 'Seizure Disorder / Status Epilepticus',
    category: 'Neurology',
    isCommon: true,
  },
  {
    reason: 'Diabetic Ketoacidosis (DKA)',
    category: 'Metabolic',
    isCommon: true,
  },
  {
    reason: 'Renal Failure / Dialysis Requirement',
    category: 'Renal',
    isCommon: true,
  },
  {
    reason: 'Poisoning / Overdose',
    category: 'Trauma / Toxic',
    isCommon: true,
  },
];
