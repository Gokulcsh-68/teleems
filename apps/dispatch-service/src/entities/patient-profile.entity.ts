import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Incident } from './incident.entity';

@Entity('patient_profiles')
export class PatientProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  organisationId: string;

  @Column()
  @Index()
  incident_id: string;

  @Column({ nullable: true })
  @Index()
  trip_id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  age: number;

  @Column()
  gender: string;

  @Column()
  triage_code: string;

  @Column({ default: false })
  is_unknown: boolean;

  @Column({ nullable: true })
  photo_url: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;
}
