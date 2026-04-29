import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Epcr } from './epcr.entity';

@Entity('epcr_acknowledgements')
export class EpcrAcknowledgement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  epcr_id: string;

  @Column()
  acknowledged_by: string;

  @Column()
  department: string;

  @Column({ type: 'timestamptz' })
  timestamp: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToOne(() => Epcr)
  @JoinColumn({ name: 'epcr_id' })
  epcr: Epcr;
}
