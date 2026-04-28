import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum OrganisationStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum SubscriptionPlan {
  BASIC = 'BASIC',
  PREMIUM = 'PREMIUM',
  ENTERPRISE = 'ENTERPRISE',
}

@Entity('organisations')
export class Organisation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  @Index()
  name: string;

  @Column({ unique: true, nullable: true })
  registration_number: string;

  @Column({ unique: true, nullable: true })
  gstin: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  city: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  zip: string;

  @Column({ default: 'India' })
  country: string;

  // Contact Person Details
  @Column({ nullable: true })
  contact_name: string;

  @Column({ nullable: true })
  contact_designation: string;

  @Column({ nullable: true })
  contact_phone: string;

  @Column({ nullable: true })
  contact_email: string;

  // Subscription Plan
  @Column({
    type: 'enum',
    enum: SubscriptionPlan,
    default: SubscriptionPlan.BASIC,
  })
  subscription_plan: SubscriptionPlan;

  @Column({ default: 10 }) // Number of vehicles licensed
  vehicle_capacity: number;

  @Column({
    type: 'enum',
    enum: OrganisationStatus,
    default: OrganisationStatus.ACTIVE,
  })
  status: OrganisationStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any; // For billing contact, document URLs, etc.

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
