export interface Role {
  name: string;
  scope: 'Platform' | 'Hospital' | 'Organisation' | 'Station' | 'Trip' | 'Patient' | 'Dispatch' | 'Own Incidents' | 'Referral' | 'Clinical';
  description?: string;
  permissions: string[];
}

export const SYSTEM_ROLES: Role[] = [
  {
    name: 'CureSelect Admin',
    scope: 'Platform',
    permissions: ['full_crud_all_entities', 'audit_log_read', 'force_password_reset'],
  },
  {
    name: 'Hospital Admin',
    scope: 'Hospital',
    permissions: ['manage_hospital_profile', 'manage_sub_accounts', 'manage_hospital_trips'],
  },
  {
    name: 'Hospital Coordinator',
    scope: 'Hospital',
    permissions: ['create_modify_trips', 'view_fleet_map', 'send_pre_alerts'],
  },
  {
    name: 'Hospital ED Doctor (ERCP)',
    scope: 'Hospital',
    permissions: ['telelink_accept_initiate', 'rtvs_view', 'epcr_read', 'clinical_notes_write'],
  },
  {
    name: 'Hospital Nurse',
    scope: 'Hospital',
    permissions: ['telelink_accept_initiate', 'epcr_read'],
  },
  {
    name: 'Fleet Operator',
    scope: 'Organisation',
    permissions: ['manage_vehicles', 'manage_staff', 'manage_inventory', 'manage_schedules'],
  },
  {
    name: 'Station Incharge',
    scope: 'Station',
    permissions: ['manage_assigned_station_vehicles', 'manage_assigned_station_crew'],
  },
  {
    name: 'Ambulance Pilot (Driver)',
    scope: 'Trip',
    permissions: ['accept_reject_trips', 'update_trip_status', 'breakdown_report'],
  },
  {
    name: 'EMT / Paramedic',
    scope: 'Patient',
    permissions: ['3c_data_capture', 'rtvs_pairing', 'telelink_patient', 'epcr_write'],
  },
  {
    name: 'On-board Doctor',
    scope: 'Clinical',
    permissions: ['3c_data_capture', 'telelink_patient', 'epcr_write', 'manage_onboard_care'],
  },
  {
    name: 'Call Centre Executive (CCE)',
    scope: 'Dispatch',
    permissions: ['create_incidents', 'dispatch_vehicles', 'view_fleet_in_zone'],
  },
  {
    name: 'Referral Hospital',
    scope: 'Referral',
    permissions: ['receive_referral_notifications'],
  },
  {
    name: 'Caller (Public)',
    scope: 'Own Incidents',
    permissions: ['create_booking', 'view_own_trip', 'rate_service'],
  },
];
