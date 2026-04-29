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

@Entity('print_jobs')
export class PrintJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  epcr_id: string;

  @Column()
  printer_device_id: string;

  @Column({ default: 'PENDING' })
  status: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @ManyToOne(() => Epcr)
  @JoinColumn({ name: 'epcr_id' })
  epcr: Epcr;
}
