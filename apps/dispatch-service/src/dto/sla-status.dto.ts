export enum SLATimerStatus {
  PENDING = 'PENDING',
  WITHIN_SLA = 'WITHIN_SLA',
  EXCEEDED = 'EXCEEDED',
}

export interface SLATimerDetail {
  target_seconds: number;
  actual_seconds: number | null;
  status: SLATimerStatus;
}

export class SLAStatusDto {
  incident_id: string;
  severity: string;
  timers: {
    dispatch: SLATimerDetail;
    on_scene: SLATimerDetail;
    total_resolution: SLATimerDetail;
  };
  overall_sla_status: 'HEALTHY' | 'WARNING' | 'VIOLATED';
}
