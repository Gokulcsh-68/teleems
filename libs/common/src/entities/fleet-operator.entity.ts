import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('fleet_operators')
export class FleetOperator {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ nullable: true })
  organisationId: string; // Link to Organisation (Aggregator)

  @Column({ type: 'simple-array', nullable: true })
  hospital_ids: string[]; // Associated hospital network IDs

  @Column({ type: 'jsonb', nullable: true })
  service_zones: {
    states?: string[];
    districts?: string[];
    cities?: string[];
    pincodes?: string[];
  };

  @Column({ nullable: true })
  cce_pool_id: string; // Call routing pool handling this operator's zones

  @Column({ default: 0 })
  vehicle_count_cap: number; // Subscription cap per operator

  @Column({ default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ nullable: true })
  contact_person: string;

  @Column({ nullable: true })
  contact_phone: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
