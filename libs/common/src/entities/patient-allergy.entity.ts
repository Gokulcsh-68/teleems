import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

@Entity('patient_allergies')
export class PatientAllergy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  allergen: string; // e.g. Penicillin, Peanuts

  @Column({
    type: 'enum',
    enum: ['MILD', 'MODERATE', 'SEVERE', 'ANAPHYLACTIC'],
    default: 'MODERATE'
  })
  severity: string;

  @Column({ nullable: true })
  reaction: string; // e.g. Rash, Anaphylaxis

  @Column()
  recorded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id', referencedColumnName: 'id' })
  patient: PatientProfile;
}
