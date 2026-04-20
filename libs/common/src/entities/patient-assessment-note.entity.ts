import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';

@Entity('patient_assessment_notes')
export class PatientAssessmentNote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  assessment_id: string;

  @Column({ type: 'text' })
  note_text: string;

  @Column({ type: 'varchar', default: 'TEXT' })
  source: 'VOICE' | 'TEXT';

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @ManyToOne('PatientAssessment', 'notes')
  @JoinColumn({ name: 'assessment_id' })
  assessment: any;
}
