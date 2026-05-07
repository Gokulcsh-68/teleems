import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';
import { Department } from './department.entity';
import { Hospital } from './hospital.entity';

export enum AdmissionStatus {
  ADMITTED = 'ADMITTED',
  DISCHARGED = 'DISCHARGED',
  TRANSFERRED = 'TRANSFERRED',
}

@Entity('admissions')
export class Admission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  @Index()
  hospital_id: string;

  @Column()
  @Index()
  department_id: string;

  @Column({ nullable: true })
  bed_number: string;

  @Column({ nullable: true, default: null })
  bed_type: string; // icu, general, isolation

  @Column({
    type: 'enum',
    enum: AdmissionStatus,
    default: AdmissionStatus.ADMITTED,
  })
  status: AdmissionStatus;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  admitted_at: Date;

  @Column({ type: 'timestamptz', nullable: true })
  discharged_at: Date;

  @Column({ nullable: true })
  admitted_by_id: string;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;

  @ManyToOne(() => Hospital)
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
