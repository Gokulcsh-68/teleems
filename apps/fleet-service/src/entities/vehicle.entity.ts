import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  OFFLINE = 'OFFLINE'
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  identifier: string; // e.g. "AMB-001"

  @Column({ nullable: true })
  @Index()
  organisationId: string;

  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.AVAILABLE,
  })
  status: VehicleStatus;

  @Column({ type: 'decimal', precision: 10, scale: 7, default: 0 })
  gps_lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, default: 0 })
  gps_lon: number;

  @Column({ nullable: true })
  type: string; // ALS, BLS

  @Column({ nullable: true })
  last_known_address: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
