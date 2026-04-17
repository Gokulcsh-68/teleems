import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum SymptomSeverity {
  IMMEDIATE = 'IMMEDIATE',
  URGENT = 'URGENT',
  MINOR = 'MINOR',
  NON_EMERGENCY = 'NON_EMERGENCY',
}

@Entity('symptom_master')
export class SymptomMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'jsonb' })
  names: Record<string, string>; // { en: "Pain", ta: "வலி", hi: "दर्द" }

  @Column({
    type: 'enum',
    enum: SymptomSeverity,
    default: SymptomSeverity.MINOR,
  })
  severity: SymptomSeverity;

  @Column({ type: 'jsonb', nullable: true })
  first_aid_instructions: Record<string, string>; // { en: "Stay calm...", ta: "நிதானமாக இருக்கவும்..." }

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
