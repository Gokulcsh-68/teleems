import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('medication_route_master')
export class MedicationRouteMaster {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // IV (Intravenous)

  @Column({ unique: true })
  @Index()
  code: string; // IV

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isCommon: boolean;
}
