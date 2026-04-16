export interface Permission {
  key: string;
  label: string;
  category: string;
}

export const PERMISSION_MASTER: Permission[] = [
  // Platform Permissions
  { key: 'full_crud_all_entities', label: 'Full CRUD on all entities', category: 'Platform' },
  { key: 'audit_log_read', label: 'Audit log read', category: 'Platform' },
  { key: 'force_password_reset', label: 'Force password reset', category: 'Platform' },
  
  // Hospital Permissions
  { key: 'manage_hospital_profile', label: 'Manage hospital profile', category: 'Hospital' },
  { key: 'manage_sub_accounts', label: 'Manage sub-accounts', category: 'Hospital' },
  { key: 'manage_hospital_trips', label: 'Manage trips for own hospital', category: 'Hospital' },
  { key: 'create_modify_trips', label: 'Create/modify trips', category: 'Hospital' },
  { key: 'view_fleet_map', label: 'View fleet map', category: 'Hospital' },
  { key: 'send_pre_alerts', label: 'Send pre-alerts', category: 'Hospital' },
  { key: 'telelink_accept_initiate', label: 'TeleLink accept/initiate', category: 'Hospital' },
  { key: 'rtvs_view', label: 'RTVS view', category: 'Hospital' },
  { key: 'epcr_read', label: 'ePCR read', category: 'Hospital' },
  { key: 'clinical_notes_write', label: 'Clinical notes write', category: 'Hospital' },

  // Organisation / Fleet Permissions
  { key: 'manage_vehicles', label: 'Manage vehicles', category: 'Organisation' },
  { key: 'manage_staff', label: 'Manage staff', category: 'Organisation' },
  { key: 'manage_inventory', label: 'Manage inventory', category: 'Organisation' },
  { key: 'manage_schedules', label: 'Manage schedules', category: 'Organisation' },

  // Station Permissions
  { key: 'manage_assigned_station_vehicles', label: 'Vehicle management for assigned station', category: 'Station' },
  { key: 'manage_assigned_station_crew', label: 'Crew management for assigned station', category: 'Station' },

  // Trip / Patient Permissions
  { key: 'accept_reject_trips', label: 'Accept/reject own trips', category: 'Trip' },
  { key: 'update_trip_status', label: 'Update trip status', category: 'Trip' },
  { key: 'breakdown_report', label: 'Breakdown report', category: 'Trip' },
  { key: '3c_data_capture', label: '3C data capture', category: 'Patient' },
  { key: 'rtvs_pairing', label: 'RTVS pairing', category: 'Patient' },
  { key: 'telelink_patient', label: 'TeleLink', category: 'Patient' },
  { key: 'epcr_write', label: 'ePCR write for active patient', category: 'Patient' },

  // Dispatch Permissions
  { key: 'create_incidents', label: 'Create incidents', category: 'Dispatch' },
  { key: 'dispatch_vehicles', label: 'Dispatch vehicles', category: 'Dispatch' },
  { key: 'view_fleet_in_zone', label: 'View all fleet in zone', category: 'Dispatch' },

  // Public / Own Incident Permissions
  { key: 'create_booking', label: 'Create booking', category: 'Own Incidents' },
  { key: 'view_own_trip', label: 'View own trip', category: 'Own Incidents' },
  { key: 'rate_service', label: 'Rate service', category: 'Own Incidents' },

  // New Permissions for v4.0 Spec
  { key: 'receive_referral_notifications', label: 'Receive referral notifications', category: 'Referral' },
  { key: 'manage_onboard_care', label: 'Manage on-board patient care', category: 'Clinical' },
];
