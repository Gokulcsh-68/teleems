import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_assessments')
export class PatientAssessment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column({ type: 'varchar' })
  type: 'VITALS' | 'GCS' | 'CLINICAL';

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

  // --- Spec 5.3: Clinical Assessment ---

  @Column({ type: 'varchar', nullable: true })
  avpu: 'A' | 'V' | 'P' | 'U' | null;

  @Column({ type: 'int', nullable: true })
  pupil_left_size: number | null;

  @Column({ type: 'varchar', nullable: true })
  pupil_left_reactivity: string | null;

  @Column({ type: 'int', nullable: true })
  pupil_right_size: number | null;

  @Column({ type: 'varchar', nullable: true })
  pupil_right_reactivity: string | null;

  @Column({ type: 'varchar', nullable: true })
  triage_code: string | null; // e.g. RED, YELLOW, GREEN, BLACK

  @Column({ type: 'text', nullable: true })
  chief_complaint: string | null;

  // HPI (History of Present Illness)
  @Column({ type: 'varchar', nullable: true })
  hpi_onset: string | null;

  @Column({ type: 'varchar', nullable: true })
  hpi_duration: string | null;

  @Column({ type: 'varchar', nullable: true })
  hpi_character: string | null;

  @Column({ type: 'varchar', nullable: true })
  hpi_severity: string | null;

  @Column({ type: 'varchar', nullable: true })
  hpi_radiation: string | null;

  @Column('simple-array', { nullable: true })
  hpi_associated_symptoms: string[];

  @Column({ type: 'jsonb', nullable: true })
  trauma_json: any;

  @OneToMany('PatientAssessmentNote', 'assessment')
  notes: any[]; // Using any[] or a more generic type to avoid circular import issues in this file

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
