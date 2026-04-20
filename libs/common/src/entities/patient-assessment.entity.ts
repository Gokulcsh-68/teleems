import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_assessments')
export class PatientAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column({ type: 'varchar' })
  type: 'VITALS' | 'GCS';

  // Vitals
  @Column({ type: 'int', nullable: true })
  bp_systolic: number | null;

  @Column({ type: 'int', nullable: true })
  bp_diastolic: number | null;

  @Column({ type: 'int', nullable: true })
  heart_rate: number | null;

  @Column({ type: 'int', nullable: true })
  spo2: number | null;

  @Column({ type: 'int', nullable: true })
  respiratory_rate: number | null;

  @Column({ type: 'float', nullable: true })
  temp_celsius: number | null;

  // GCS
  @Column({ type: 'int', nullable: true })
  gcs_eye: number | null;

  @Column({ type: 'int', nullable: true })
  gcs_verbal: number | null;

  @Column({ type: 'int', nullable: true })
  gcs_motor: number | null;

  @Column({ type: 'int', nullable: true })
  gcs_total: number | null;

  @Column({ type: 'timestamptz' })
  taken_at: Date;

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;
}
