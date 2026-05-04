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
import { Incident } from './incident.entity';

@Entity('incident_feedback')
export class IncidentFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'incident_id', type: 'uuid' })
  @Index()
  incidentId: string;

  @ManyToOne(() => Incident)
  @JoinColumn({ name: 'incident_id' })
  incident: Incident;

  @Column({ type: 'int' })
  rating: number; // 1 to 5

  @Column({ type: 'text', nullable: true })
  comment: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index()
  userId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
