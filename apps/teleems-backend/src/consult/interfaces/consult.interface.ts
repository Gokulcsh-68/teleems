import { ConsultStatus } from '@app/common';

export interface IConsult {
  id: string;
  patient_id?: string;
  incident_id?: string;
  doctor_id: string;
  secondary_doctor_id?: string;
  emt_id?: string;
  status: ConsultStatus;
  scheduled_at: Date;
  started_at?: Date;
  ended_at?: Date;
  reason?: string;
  consult_type?: string;
  room_id?: string;
  room_url?: string;
  room_token?: string;
  organisation_id: string;
  clinical_notes?: Record<string, any>;
  additional_info?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}
