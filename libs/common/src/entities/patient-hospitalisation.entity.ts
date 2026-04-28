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

@Entity('patient_hospitalisations')
export class PatientHospitalisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  reason: string;

  @Column({ nullable: true })
  admission_date: string;

  @Column({ nullable: true })
  discharge_date: string;

  @Column({ nullable: true })
  hospital_name: string;

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: PatientProfile;
}
