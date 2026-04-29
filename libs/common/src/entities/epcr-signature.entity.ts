import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Epcr } from './epcr.entity';

export enum SignerRole {
  EMT = 'EMT',
  DOCTOR = 'DOCTOR',
  PATIENT = 'PATIENT',
  CLINICIAN = 'CLINICIAN',
}

@Entity('epcr_signatures')
export class EpcrSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  epcr_id: string;

  @Column({
    type: 'enum',
    enum: SignerRole,
  })
  signer_role: SignerRole;

  @Column()
  signer_id: string; // User ID or Name

  @Column({ nullable: true })
  designation: string;

  @Column()
  signature_url: string;

  @Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
  gps_lat: number;

  @Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
  gps_lon: number;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @ManyToOne(() => Epcr)
  @JoinColumn({ name: 'epcr_id' })
  epcr: Epcr;
}
