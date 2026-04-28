import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('medication_master')
export class MedicationMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // e.g. Paracetamol, Aspirin

  @Column({ nullable: true })
  @Index()
  category: string; // e.g. Analgesic, NSAID, Antibiotic

  @Column({ nullable: true })
  default_route: string; // e.g. Oral, IV, IM

  @Column('simple-array', { nullable: true })
  common_dosages: string[]; // e.g. ['500mg', '1000mg']

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @Column({ default: false })
  isCommon: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
