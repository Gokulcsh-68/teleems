import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_surgeries')
export class PatientSurgery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  surgery_name: string;

  @Column({ nullable: true })
  date: string;

  @Column({ nullable: true })
  notes: string;

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: PatientProfile;
}
