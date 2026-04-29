import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { EpcrSignature } from './epcr-signature.entity';

@Entity('epcrs')
export class Epcr {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  trip_id: string;

  @Column({ nullable: true })
  @Index()
  patient_id: string;

  @Column({ nullable: true })
  @Index()
  hospital_id: string;

  @Column()
  pdf_url: string;

  @Column({ type: 'text', nullable: true })
  thermal_payload: string;

  @Column({ type: 'jsonb', nullable: true })
  bundle_data: any;

  @Column({ nullable: true })
  triage_code: string;

  @Column({ default: 'DRAFT' })
  status: string;

  @Column({ nullable: true })
  @Index()
  mrn: string;

  @Column({ nullable: true })
  @Index()
  hmis_record_id: string;

  @Column({ type: 'jsonb', default: [] })
  special_flags: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToMany(() => EpcrSignature, (sig) => sig.epcr)
  signatures: EpcrSignature[];
}
