import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Hospital } from './hospital.entity';

@Entity('departments')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ name: 'head_of_department', nullable: true })
  headOfDepartment: string;

  @Column({ name: 'total_beds_capacity', default: 0 })
  totalBedsCapacity: number;

  @Column({ name: 'occupied_beds', default: 0 })
  occupiedBeds: number;

  get availableBeds(): number {
    return Math.max(0, this.totalBedsCapacity - this.occupiedBeds);
  }

  @Column({ name: 'contact_phone', nullable: true })
  contactPhone: string;

  @Column({ name: 'hospital_id' })
  @Index()
  hospitalId: string;

  @Column({ default: true })
  @Index()
  isActive: boolean;

  @ManyToOne(() => Hospital, (hospital) => hospital.departments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'hospital_id' })
  hospital: Hospital;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
