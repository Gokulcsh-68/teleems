import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Incident } from './incident.entity';

@Entity('incident_escalations')
export class IncidentEscalation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  incident_id: string;

  @Column()
  escalated_by: string; // User ID from JWT

  @Column()
  escalate_to: string; // Target User ID

  @Column({ type: 'text' })
  reason: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;
}
