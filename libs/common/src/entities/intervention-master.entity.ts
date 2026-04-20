import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('intervention_master')
export class InterventionMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // e.g. Endotracheal Intubation, CPR

  @Column({ nullable: true })
  @Index()
  category: string; // e.g. Airway, Cardiac, Vascular

  @Column({ default: false })
  requires_specialized_logging: boolean; // Triggers structured forms for CPR/Defib

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
