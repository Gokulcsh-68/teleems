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

@Entity('patient_medication_logs')
export class PatientMedicationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  @Index()
  drug_name: string;

  @Column({ nullable: true })
  dose_mg: string;

  @Column({ nullable: true })
  route: string; // IV, IM, PO, SL, INH, NASAL, etc.

  @Column({ type: 'timestamptz' })
  time: Date;

  @Column()
  recorded_by_id: string; // EMT ID

  @Column({ type: 'uuid', nullable: true })
  inventory_item_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;
}
