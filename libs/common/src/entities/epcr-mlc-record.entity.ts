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

@Entity('epcr_mlc_records')
export class EpcrMlcRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  epcr_id: string;

  @Column({ nullable: true })
  fir_number: string;

  @Column({ nullable: true })
  police_station: string;

  @Column({ nullable: true })
  officer_name: string;

  @Column({ nullable: true })
  officer_contact: string;

  @Column({ type: 'timestamptz' })
  intimation_time: Date;

  @Column()
  intimated_by: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;

  @OneToOne(() => Epcr)
  @JoinColumn({ name: 'epcr_id' })
  epcr: Epcr;
}
