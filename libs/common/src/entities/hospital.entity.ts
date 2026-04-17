import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum HospitalType {
  GOVERNMENT = 'GOVERNMENT',
  PRIVATE = 'PRIVATE',
  TRUST = 'TRUST',
}

@Entity('hospitals')
export class Hospital {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({
    type: 'enum',
    enum: HospitalType,
    default: HospitalType.PRIVATE,
  })
  type: HospitalType;

  @Column({ nullable: true })
  district: string;

  @Column({ type: 'simple-array', nullable: true })
  specialties: string[]; // ['CARDIAC', 'BURNS', 'TRAUMA']

  @Column({ nullable: true })
  accreditation: string;

  @Column({ default: false })
  nabh_status: boolean;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  gps_lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  gps_lon: number;

  @Column({ default: 10 }) // Service area radius in km
  service_radius: number;

  @Column({ nullable: true })
  emergency_phone: string;

  @Column({ nullable: true })
  contact_phone: string;

  @Column({ nullable: true })
  contact_email: string;

  @Column({ nullable: true })
  medical_director: string;

  // Bed Capacity Metadata
  @Column({ type: 'jsonb', nullable: true })
  bed_capacity: {
    icu: number;
    er: number;
    general: number;
    ventilators: number;
    updated_at: string;
  };

  @Column({ type: 'simple-array', nullable: true })
  referral_for_orgs: string[]; // List of organisation IDs this hospital serves

  @Column({ type: 'jsonb', nullable: true })
  routing_rules: any; // Hospital-specific teleconsult rules

  @Column({ default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE';

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
