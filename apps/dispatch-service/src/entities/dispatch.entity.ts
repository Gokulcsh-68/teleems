import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('dispatches')
export class Dispatch {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  incident_id: string;

  @Column()
  vehicle_id: string;

  @Column()
  dispatched_by: string;

  @Column({ default: 'DISPATCHED' })
  status: string; // DISPATCHED, EN_ROUTE, ON_SCENE, TRANSPORTING, COMPLETED, CANCELLED

  @Column({ type: 'uuid', nullable: true })
  @Index()
  driver_id: string;

  @Column({ type: 'uuid', nullable: true })
  @Index()
  emt_id: string;

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
}
