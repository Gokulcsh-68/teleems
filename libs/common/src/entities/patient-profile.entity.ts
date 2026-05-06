import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('patient_profiles')
export class PatientProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  @Index()
  organisationId: string;

  @Column({ nullable: true })
  @Index()
  incident_id: string;

  @Column({ nullable: true })
  @Index()
  trip_id: string;

  @Column({ nullable: true })
  name: string;

  @Column({ nullable: true })
  age: number;

  @Column({ nullable: true })
  age_range: string;

  @Column()
  gender: string;

  @Column()
  triage_code: string;

  @Column({ default: false })
  is_unknown: boolean;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  mrn: string;

  @Column({ nullable: true })
  abha_id: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  informer_name: string;

  @Column({ nullable: true })
  informer_relation: string;

  @Column({ nullable: true })
  informer_phone: string;

  @Column({ default: false })
  is_mlc: boolean;

  @Column({ nullable: true })
  mlc_fir_number: string;

  @Column({ nullable: true })
  mlc_police_station: string;

  @Column({ nullable: true })
  mlc_officer_contact: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
