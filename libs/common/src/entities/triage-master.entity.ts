import { Entity, Column } from 'typeorm';
import { BaseEntity } from './base.entity';

@Entity('triage_master')
export class TriageMaster extends BaseEntity {
  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column()
  hex_color: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 0 })
  priority: number;

  @Column({ default: true })
  isActive: boolean;
}
