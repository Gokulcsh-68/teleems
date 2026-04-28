export const COMMON_SURGERIES = [
  // General Surgery
  { name: 'Appendectomy', category: 'General Surgery', isCommon: true },
  {
    name: 'Cholecystectomy (Gallbladder Removal)',
    category: 'General Surgery',
    isCommon: true,
  },
  { name: 'Hernia Repair', category: 'General Surgery', isCommon: true },
  { name: 'Mastectomy', category: 'General Surgery', isCommon: false },
  { name: 'Thyroidectomy', category: 'General Surgery', isCommon: false },

  // Cardiovascular
  {
    name: 'Coronary Artery Bypass Graft (CABG)',
    category: 'Cardiovascular',
    isCommon: true,
  },
  {
    name: 'Angioplasty / Stenting',
    category: 'Cardiovascular',
    isCommon: true,
  },
  { name: 'Valve Replacement', category: 'Cardiovascular', isCommon: false },
  { name: 'Pacemaker Insertion', category: 'Cardiovascular', isCommon: true },

  // Orthopedic
  { name: 'Total Knee Replacement', category: 'Orthopedic', isCommon: true },
  { name: 'Total Hip Replacement', category: 'Orthopedic', isCommon: true },
  { name: 'Arthroscopy', category: 'Orthopedic', isCommon: true },
  { name: 'Spinal Fusion', category: 'Orthopedic', isCommon: false },

  // Neurosurgery
  { name: 'Craniotomy', category: 'Neurosurgery', isCommon: false },
  { name: 'Laminectomy', category: 'Neurosurgery', isCommon: false },

  // Obstetrics & Gynecology
  { name: 'Cesarean Section (C-Section)', category: 'OB/GYN', isCommon: true },
  { name: 'Hysterectomy', category: 'OB/GYN', isCommon: true },
  { name: 'Oophorectomy', category: 'OB/GYN', isCommon: false },

  // Urology
  { name: 'Prostatectomy', category: 'Urology', isCommon: false },
  {
    name: 'Nephrectomy (Kidney Removal)',
    category: 'Urology',
    isCommon: false,
  },
  { name: 'Cystoscopy', category: 'Urology', isCommon: true },

  // Ophthalmology
  { name: 'Cataract Surgery', category: 'Ophthalmology', isCommon: true },
  { name: 'LASIK', category: 'Ophthalmology', isCommon: false },

  // Others
  { name: 'Tonsillectomy', category: 'ENT', isCommon: true },
  { name: 'Wisdom Tooth Extraction', category: 'Dental', isCommon: true },
];
