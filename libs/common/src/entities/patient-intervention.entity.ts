import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_interventions')
export class PatientIntervention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  type: string; // OXYGEN, IV, MEDICATION, AIRWAY, CPR, etc.

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  dosage: string;

  @Column({ type: 'timestamptz' })
  administered_at: Date;

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;
}
