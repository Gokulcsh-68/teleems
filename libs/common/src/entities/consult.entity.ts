import { Entity, Column, Index, ManyToOne, JoinColumn } from 'typeorm';
import { BaseEntity } from './base.entity';
import { PatientProfile } from './patient-profile.entity';
import { Incident } from './incident.entity';
import { User } from './user.entity';

export enum ConsultStatus {
  PENDING = 'PENDING',
  ACTIVE = 'ACTIVE',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

@Entity('consults')
export class Consult extends BaseEntity {
  @Column({ type: 'uuid', nullable: true })
  @Index()
  patient_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  incident_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  doctor_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  secondary_doctor_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  emt_id: string;

  @Column({
    type: 'enum',
    enum: ConsultStatus,
    default: ConsultStatus.PENDING,
  })
  status: ConsultStatus;

  @Column({ type: 'timestamptz', nullable: true })
  scheduled_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  started_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  ended_at: Date;

  @Column({ type: 'text', nullable: true })
  reason: string;

  @Column({ type: 'text', nullable: true })
  consult_type: string;

  @Column({ type: 'text', nullable: true })
  room_id: string;

  @Column({ type: 'text', nullable: true })
  room_url: string;

  @Column({ type: 'text', nullable: true })
  room_token: string;

  @Column({ nullable: true })
  @Index()
  organisation_id: string;

  @Column({ type: 'jsonb', nullable: true })
  clinical_notes: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  additional_info: Record<string, any>;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'doctor_id' })
  doctor: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'secondary_doctor_id' })
  secondary_doctor: User;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'emt_id' })
  emt: User;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;
}
