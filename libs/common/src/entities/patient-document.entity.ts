import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { PatientProfile } from './patient-profile.entity';

export enum PatientDocumentType {
  AADHAAR = 'AADHAAR',
  INSURANCE = 'INSURANCE',
  PRESCRIPTION = 'PRESCRIPTION',
  DISCHARGE_SUMMARY = 'DISCHARGE_SUMMARY',
  OTHER = 'OTHER',
}

@Entity('patient_documents')
export class PatientDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  url: string;

  @Column({
    type: 'enum',
    enum: PatientDocumentType,
    default: PatientDocumentType.OTHER,
  })
  doc_type: PatientDocumentType;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column()
  uploaded_by_id: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;
}
