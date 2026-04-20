export const COMMON_ICD10_CODES = [
  // Cardiovascular
  { code: 'I46.9', description: 'Cardiac arrest, cause unspecified', category: 'Cardiovascular', isCommon: true },
  { code: 'I21.9', description: 'Acute myocardial infarction, unspecified', category: 'Cardiovascular', isCommon: true },
  { code: 'I10', description: 'Essential (primary) hypertension', category: 'Cardiovascular', isCommon: true },
  
  // Respiratory
  { code: 'J06.9', description: 'Acute upper respiratory infection, unspecified', category: 'Respiratory', isCommon: true },
  { code: 'J44.9', description: 'Chronic obstructive pulmonary disease, unspecified', category: 'Respiratory', isCommon: true },
  { code: 'J45.909', description: 'Unspecified asthma, uncomplicated', category: 'Respiratory', isCommon: true },

  // Endocrine / Metabolic
  { code: 'E11.9', description: 'Type 2 diabetes mellitus without complications', category: 'Endocrine', isCommon: true },
  { code: 'E10.9', description: 'Type 1 diabetes mellitus without complications', category: 'Endocrine', isCommon: true },
  { code: 'E16.2', description: 'Hypoglycemia, unspecified', category: 'Metabolic', isCommon: true },

  // Neurological
  { code: 'I63.9', description: 'Cerebral infarction, unspecified (Stroke)', category: 'Neurological', isCommon: true },
  { code: 'G40.909', description: 'Epilepsy, unspecified, not intractable', category: 'Neurological', isCommon: true },

  // Trauma / Injury
  { code: 'S06.9X0A', description: 'Unspecified intracranial injury, initial encounter', category: 'Trauma', isCommon: true },
  { code: 'S36.90XA', description: 'Unspecified injury of unspecified intra-abdominal organ', category: 'Trauma', isCommon: true },
  { code: 'T14.90', description: 'Injury, unspecified', category: 'Trauma', isCommon: true },

  // General / Emergency
  { code: 'R05', description: 'Cough', category: 'General', isCommon: true },
  { code: 'R06.02', description: 'Shortness of breath', category: 'General', isCommon: true },
  { code: 'R07.9', description: 'Chest pain, unspecified', category: 'General', isCommon: true },
  { code: 'R50.9', description: 'Fever, unspecified', category: 'General', isCommon: true },
  { code: 'R51', description: 'Headache', category: 'General', isCommon: true },
  { code: 'R55', description: 'Syncope and collapse', category: 'General', isCommon: true },
];
