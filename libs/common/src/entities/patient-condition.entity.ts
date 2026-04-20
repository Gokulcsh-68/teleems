import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_conditions')
export class PatientCondition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  icd10_code: string;

  @Column({ nullable: true })
  since: string; // approximate date or year

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: PatientProfile;
}
