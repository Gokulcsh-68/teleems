import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Incident } from './incident.entity';
import { Hospital } from './hospital.entity';
import { Vehicle } from './vehicle.entity';

@Entity('dispatches')
export class Dispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ nullable: true })
  vehicle_id: string;

  @Column()
  dispatched_by: string;

  @Column({ default: 'DISPATCHED' })
  status: string; // DISPATCHED, EN_ROUTE, ON_SCENE, TRANSPORTING, COMPLETED, CANCELLED

  @Column({ type: 'uuid', nullable: true })
  @Index()
  driver_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  emt_id: string | null;

  @Column({ type: 'int', nullable: true })
  eta_seconds: number | null;

  @Column({ type: 'varchar', nullable: true })
  manual_vehicle_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  override_reason: string | null;

  @Column({ default: false })
  is_manual_override: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  dispatched_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'varchar', nullable: true })
  destination_hospital_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  actual_hospital_id: string | null;

  @Column({ type: 'text', nullable: true })
  cancellation_reason: string | null;

  @Column({ type: 'text', nullable: true })
  breakdown_reason: string | null;

  @Column({ type: 'varchar', nullable: true })
  breakdown_category: string | null;

  @Column({ type: 'varchar', nullable: true })
  epcr_draft_url: string | null;

  @Column({ type: 'boolean', default: false })
  is_ift: boolean;

  @Column({ type: 'varchar', nullable: true })
  origin_hospital_id: string | null;

  @Column({ type: 'jsonb', nullable: true })
  ift_metadata: any | null;

  @Column({ type: 'jsonb', nullable: true })
  refusal_record: any | null;

  @Column({ nullable: true })
  @Index()
  organisationId: string;

  @Column()
  @Index()
  incident_id: string;

  @ManyToOne(() => Hospital)
  @JoinColumn({ name: 'destination_hospital_id' })
  destination_hospital: Hospital;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;


  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;
}
