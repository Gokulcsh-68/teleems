import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  BUSY = 'BUSY',
  DISPATCHED = 'DISPATCHED',
  MAINTENANCE = 'MAINTENANCE',
  OFFLINE = 'OFFLINE',
}

export enum VehicleType {
  ALS = 'ALS',
  BLS = 'BLS',
  TRANSPORT = 'TRANSPORT',
}

export enum OwnershipType {
  OWNED = 'OWNED',
  LEASED = 'LEASED',
  HOSPITAL_OWNED = 'HOSPITAL_OWNED',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  @Index()
  registration_number: string; // e.g. "MH-12-AB-1234"

  @Column({ nullable: true })
  chassis_number: string;

  @Column({ nullable: true })
  engine_number: string;

  @Column({ nullable: true })
  brand: string;

  @Column({ nullable: true })
  model: string;

  @Column({ nullable: true })
  make_year: number;

  @Column({
    type: 'enum',
    enum: VehicleType,
    default: VehicleType.BLS,
  })
  vehicle_type: VehicleType;

  @Column({ default: 1 })
  stretcher_capacity: number;

  @Column({
    type: 'enum',
    enum: OwnershipType,
    default: OwnershipType.OWNED,
  })
  ownership_type: OwnershipType;

  @Column({ nullable: true })
  @Index()
  organisationId: string;

  @Column({ nullable: true })
  @Index()
  station_id: string; // Linked station/dispatch point

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
  last_known_address: string;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
