import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('incident_category_master')
export class IncidentCategoryMaster {
  @PrimaryColumn()
  id: string; // Slug like 'IMMEDIATE', 'URGENT', 'IFT'

  @Column()
  name: string;

  @Column({ nullable: true })
  color_code: string; // Red, Orange, Green, White, Black, Blue

  @Column({ nullable: true })
  hex_color: string;

  @Column({ type: 'jsonb', nullable: true })
  auto_escalation_rules: {
    enabled: boolean;
    timer_minutes?: number;
    upgrade_to?: string;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
