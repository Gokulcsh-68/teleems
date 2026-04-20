import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('hospitalisation_master')
export class HospitalisationMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  reason: string; // e.g. Pneumonia, Asthma Exacerbation, Road Traffic Accident

  @Column({ nullable: true })
  @Index()
  category: string; // e.g. Respiratory, Cardiovascular, Trauma, Infectious

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
