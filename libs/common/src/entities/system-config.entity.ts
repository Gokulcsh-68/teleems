import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum ConfigCategory {
  SLA = 'SLA',
  NOTIFICATION = 'NOTIFICATION',
  INFRA = 'INFRA',
  MAPS = 'MAPS',
}

@Entity('system_configs')
export class SystemConfig {
  @PrimaryColumn()
  key: string;

  @Column({ type: 'jsonb' })
  value: any;

  @Column({
    type: 'enum',
    enum: ConfigCategory,
    default: ConfigCategory.INFRA,
  })
  category: ConfigCategory;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
