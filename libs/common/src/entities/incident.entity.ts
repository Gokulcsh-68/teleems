import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('incidents')
export class Incident {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  category: string;

  @Column()
  severity: string;

  @Column({ nullable: true })
  caller_id: string;

  @Column({ nullable: true })
  organisationId: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  gps_lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  gps_lon: number;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'jsonb' })
  patients: {
    id: string;
    name?: string; 
    age?: number; 
    age_range?: string;
    gender: string; 
    triage_level: string; 
    mrn?: string;
    phone?: string;
    informer_name?: string;
    informer_relation?: string;
    informer_phone?: string;
    is_mlc?: boolean;
    mlc_fir_number?: string;
    mlc_police_station?: string;
    mlc_officer_contact?: string;
    conditions?: string[];
    medications?: string[];
    allergies?: any[];
    symptoms?: { name: string; duration_minutes?: number }[] 
  }[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'varchar', nullable: true })
  guest_name: string;

  @Column({ type: 'varchar', nullable: true })
  guest_phone: string;

  @Column({ default: 'PENDING' })
  status: string;

  @Column({ type: 'varchar', nullable: true })
  assigned_vehicle: string | null;

  @Column({ type: 'int', nullable: true })
  eta_seconds: number | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
