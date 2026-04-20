import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('chief_complaint_master')
export class ChiefComplaintMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // e.g. Chest Pain, Shortness of Breath

  @Column({ nullable: true })
  @Index()
  category: string; // e.g. Medical, Trauma, OB/GYN

  @Column({ default: 'YELLOW' })
  default_triage: string; // RED, YELLOW, GREEN, BLACK

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ default: false })
  isCommon: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
