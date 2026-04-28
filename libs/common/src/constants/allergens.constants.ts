export const COMMON_ALLERGENS = [
  // Drug Allergies
  { name: 'Penicillin', category: 'Drug', isCommon: true },
  { name: 'Amoxicillin', category: 'Drug', isCommon: true },
  { name: 'Sulfa Drugs', category: 'Drug', isCommon: true },
  { name: 'Aspirin', category: 'Drug', isCommon: true },
  { name: 'Ibuprofen (NSAIDs)', category: 'Drug', isCommon: true },
  { name: 'Chemotherapy Drugs', category: 'Drug', isCommon: false },

  // Food Allergies
  { name: 'Peanuts', category: 'Food', isCommon: true },
  { name: 'Tree Nuts (Walnuts, Cashews)', category: 'Food', isCommon: true },
  { name: 'Shellfish (Shrimp, Lobster)', category: 'Food', isCommon: true },
  { name: 'Eggs', category: 'Food', isCommon: true },
  { name: 'Milk / Dairy', category: 'Food', isCommon: true },
  { name: 'Soy', category: 'Food', isCommon: true },
  { name: 'Wheat / Gluten', category: 'Food', isCommon: true },
  { name: 'Fish', category: 'Food', isCommon: true },

  // Environmental / Others
  { name: 'Latex', category: 'Environmental', isCommon: true },
  { name: 'Bee Stings (Venom)', category: 'Environmental', isCommon: true },
  { name: 'Mold Spores', category: 'Environmental', isCommon: false },
  { name: 'Dust Mites', category: 'Environmental', isCommon: true },
  {
    name: 'Pet Dander (Cats, Dogs)',
    category: 'Environmental',
    isCommon: true,
  },
  {
    name: 'Pollen (Ragweed, Grass)',
    category: 'Environmental',
    isCommon: true,
  },
  {
    name: 'Contrast Dye (X-ray/CT)',
    category: 'Environmental',
    isCommon: false,
  },
];
