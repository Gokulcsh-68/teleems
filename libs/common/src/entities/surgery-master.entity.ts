import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('surgery_master')
export class SurgeryMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // e.g. Appendectomy, CABG

  @Column({ nullable: true })
  @Index()
  category: string; // e.g. General Surgery, Cardiovascular, Orthopedic

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
