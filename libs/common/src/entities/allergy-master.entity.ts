import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('allergy_master')
export class AllergyMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // e.g. Penicillin, Peanuts, Latex

  @Column({ nullable: true })
  @Index()
  category: string; // e.g. Drug, Food, Environmental

  @Column({ default: false })
  isCommon: boolean;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
