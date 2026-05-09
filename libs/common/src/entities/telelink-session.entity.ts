import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Dispatch } from './dispatch.entity';
import { PatientProfile } from './patient-profile.entity';
import { Incident } from './incident.entity';

export enum TeleLinkSessionStatus {
  ACTIVE = 'ACTIVE',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  DEFERRED = 'DEFERRED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('telelink_sessions')
export class TeleLinkSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Index()
  trip_id: string;

  @Column()
  @Index()
  incident_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  patient_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  target_hospital_id: string;

  @Column({ default: false })
  sos_flag: boolean;

  @Column({ default: 'EMT' })
  initiator_role: string;

  @Column({
    type: 'enum',
    enum: TeleLinkSessionStatus,
    default: TeleLinkSessionStatus.ACTIVE,
  })
  status: TeleLinkSessionStatus;

  @Column({ nullable: true })
  room_id: string;

  @Column({ type: 'text', nullable: true })
  room_url: string;

  @Column({ type: 'text', nullable: true })
  room_token: string;

  @Column({ nullable: true })
  @Index()
  organisationId: string;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'uuid', nullable: true })
  initiator_id: string;

  @Column({ type: 'uuid', nullable: true })
  professional_id: string;

  @Column({ type: 'jsonb', nullable: true })
  clinical_record: Record<string, any>;

  @Column({ default: false })
  is_recording: boolean;

  @Column({ default: false })
  recording_consent: boolean;

  @Column({ nullable: true })
  escalated_to: string;

  @Column({ type: 'timestamptz', nullable: true })
  escalated_at: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at: Date;

  @ManyToOne(() => Dispatch)
  @JoinColumn({ name: 'trip_id' })
  trip: Dispatch;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @Column({ type: 'jsonb', nullable: true })
  additional_info: Record<string, any>;
}
