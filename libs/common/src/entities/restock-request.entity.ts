import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Vehicle } from './vehicle.entity';
import { User } from './user.entity';

export enum RestockRequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  COMPLETED = 'COMPLETED',
}

@Entity('restock_requests')
export class RestockRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'vehicle_id', type: 'uuid' })
  @Index()
  vehicle_id: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle;

  @Column({ name: 'requested_by_id', type: 'uuid' })
  @Index()
  requested_by_id: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requested_by_id' })
  requested_by: User;

  @Column({
    type: 'enum',
    enum: RestockRequestStatus,
    default: RestockRequestStatus.PENDING,
  })
  status: RestockRequestStatus;

  @Column({ type: 'jsonb' })
  items: {
    itemId: string;
    name: string;
    quantityRequested: number;
  }[];

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  @Index()
  organisation_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
