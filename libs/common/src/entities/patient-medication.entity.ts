import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_medications')
export class PatientMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  name: string; // e.g. Aspirin

  @Column({ nullable: true })
  dose: string; // e.g. 75mg

  @Column({ nullable: true })
  frequency: string; // e.g. Once daily

  @Column({ nullable: true })
  route: string; // e.g. Oral, IV

  @Column({ nullable: true })
  since: string;

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: PatientProfile;
}
