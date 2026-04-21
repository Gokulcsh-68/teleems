import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { StaffProfile } from './staff-profile.entity';

export enum DutyShiftStatus {
  ON_DUTY = 'ON_DUTY',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED'
}

@Entity('duty_shifts')
export class DutyShift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid', nullable: true })
  @Index()
  vehicleId: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  @Index()
  driverId: string | null;

  @ManyToOne(() => StaffProfile)
  @JoinColumn({ name: 'driver_id' })
  driver: StaffProfile;

  @Column({ name: 'staff_id', type: 'uuid', nullable: true })
  @Index()
  staffId: string | null; // EMT or Doctor

  @ManyToOne(() => StaffProfile)
  @JoinColumn({ name: 'staff_id' })
  staff: StaffProfile;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  @Index()
  organisationId: string | null;

  @Column({ type: 'timestamptz' })
  startTime: Date;

  @Column({ type: 'timestamptz', nullable: true })
  endTime: Date;

  @Column({
    type: 'enum',
    enum: DutyShiftStatus,
    default: DutyShiftStatus.ON_DUTY
  })
  status: DutyShiftStatus;

  @Column({ type: 'jsonb', nullable: true })
  checklist: {
    oxygen_level?: string;
    stretcher_condition?: string;
    inventory_checked?: boolean;
    fuel_level?: string;
    odometer_start?: number;
    odometer_end?: number;
  };

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
