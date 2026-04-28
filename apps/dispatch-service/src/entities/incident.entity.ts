import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity()
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
    gender: string;
    triage_code: string;
    symptoms?: string[];
  }[];

  @Column({ type: 'text', nullable: true })
  notes: string;

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
