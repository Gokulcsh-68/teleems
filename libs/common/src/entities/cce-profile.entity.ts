import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum RoutingStrategy {
  ROUND_ROBIN = 'ROUND_ROBIN',
  GEO_PRIORITY = 'GEO_PRIORITY',
  LOAD_BASED = 'LOAD_BASED',
}

@Entity('cce_profiles')
export class CCEProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @Column({ type: 'jsonb', nullable: true })
  assigned_zones: {
    state?: string;
    city?: string;
    pincode?: string;
  }[];

  @Column({
    type: 'enum',
    enum: RoutingStrategy,
    default: RoutingStrategy.ROUND_ROBIN,
  })
  routing_strategy: RoutingStrategy;

  @Column({ type: 'jsonb', nullable: true })
  sla_config: {
    max_hold_seconds: number;
    max_dispatch_seconds: number;
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
