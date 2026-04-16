import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('incident_timeline')
export class IncidentTimeline {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  incident_id: string;

  @Column({ nullable: true })
  user_id: string;

  @Column()
  type: string; // e.g., 'CREATED', 'STATUS_CHANGE', 'ASSIGNMENT', 'UPDATED', 'CANCELLED'

  @Column()
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
