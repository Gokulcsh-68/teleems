import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_interventions')
export class PatientIntervention {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  type:
    | 'CPR'
    | 'DEFIB'
    | 'IV_ACCESS'
    | 'INTUBATION'
    | 'OXYGEN'
    | 'SPLINT'
    | 'TOURNIQUET'
    | 'CATHETER'
    | 'OTHER'
    | string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ nullable: true })
  dosage: string;

  @Column({ type: 'jsonb', nullable: true })
  detail_json: any;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;
}
