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

export enum ValuableLocationType {
  SCENE = 'SCENE',
  HANDOFF = 'HANDOFF',
}

@Entity('patient_valuables')
export class PatientValuable {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  patient_id: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({
    type: 'enum',
    enum: ValuableLocationType,
    default: ValuableLocationType.SCENE,
  })
  location_type: ValuableLocationType;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  gps_lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  gps_lon: number;

  @Column()
  logged_by_id: string;

  @Column({ type: 'timestamptz', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz', select: false })
  created_at: Date;

  @ManyToOne(() => PatientProfile)
  @JoinColumn({ name: 'patient_id' })
  patient: PatientProfile;
}
