import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { StaffProfile } from './staff-profile.entity';

export enum ShiftType {
  DAY = 'DAY',
  NIGHT = 'NIGHT',
  FULL_24H = 'FULL_24H'
}

@Entity('duty_rosters')
export class DutyRoster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'organisation_id', type: 'uuid' })
  @Index()
  organisationId: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  @Index()
  vehicleId: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'driver_id', type: 'uuid' })
  @Index()
  driverId: string;

  @ManyToOne(() => StaffProfile)
  @JoinColumn({ name: 'driver_id' })
  driver: StaffProfile;

  @Column({ name: 'staff_id', type: 'uuid' })
  @Index()
  staffId: string; // EMT or Doctor

  @ManyToOne(() => StaffProfile)
  @JoinColumn({ name: 'staff_id' })
  staff: StaffProfile;

  @Column({ type: 'date' })
  @Index()
  startDate: Date;

  @Column({ type: 'date' })
  @Index()
  endDate: Date;

  @Column({
    type: 'enum',
    enum: ShiftType,
    default: ShiftType.FULL_24H
  })
  shiftType: ShiftType;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
