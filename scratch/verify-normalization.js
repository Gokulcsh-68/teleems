const roleMapping = {
  'ED_DOCTOR': 'Hospital ED Doctor (ERCP)',
  'NURSE': 'Hospital Nurse',
  'COORDINATOR': 'Hospital Coordinator',
  'CO-ORDINATOR': 'Hospital Coordinator',
  'HOSPITAL-COORDINATOR': 'Hospital Coordinator',
  'HOSPITAL_COORDINATOR': 'Hospital Coordinator',
  'ADMIN': 'Hospital Admin',
  'EMT': 'EMT / Paramedic',
  'CURESELECT_ADMIN': 'CureSelect Admin',
};

function normalize(role) {
  const upper = role.toUpperCase();
  return roleMapping[upper] || role;
}

const tests = [
  'coordinator',
  'co-ordinator',
  'HOSPITAL-COORDINATOR',
  'hospital_coordinator',
  'ed_doctor',
  'nurse'
];

console.log('--- Role Normalization Test ---');
tests.forEach(t => {
  console.log(`${t} -> ${normalize(t)}`);
});
