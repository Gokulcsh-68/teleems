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

@Entity('epcr_delivery_logs')
export class EpcrDeliveryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  epcr_id: string;

  @Column()
  channel: string; // SMS, EMAIL, WHATSAPP

  @Column()
  recipient: string; // Contact info

  @Column()
  recipient_type: string; // HOSPITAL, FAMILY, CUSTOM

  @Column({ default: 'SENT' })
  status: string; // SENT, FAILED, PENDING

  @Column({ nullable: true })
  error_message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  timestamp: Date;

  @ManyToOne(() => Epcr)
  @JoinColumn({ name: 'epcr_id' })
  epcr: Epcr;
}
