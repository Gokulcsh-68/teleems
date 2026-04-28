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

export enum PatientPhotoCategory {
  PATIENT_FACE = 'PATIENT_FACE',
  INJURY = 'INJURY',
  SCENE = 'SCENE',
  DOCUMENT = 'DOCUMENT',
  VALUABLES = 'VALUABLES',
  OTHER = 'OTHER',
}

@Entity('patient_photos')
export class PatientPhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column()
  url: string;

  @Column({
    type: 'enum',
    enum: PatientPhotoCategory,
    default: PatientPhotoCategory.OTHER,
  })
  category: PatientPhotoCategory;

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
