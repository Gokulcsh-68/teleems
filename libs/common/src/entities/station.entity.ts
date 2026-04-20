import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { Organisation } from './organisation.entity';

@Entity('stations')
export class Station {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ type: 'decimal', precision: 10, scale: 7, default: 0 })
  gps_lat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, default: 0 })
  gps_lon: number;

  @Column({ nullable: true })
  incharge_name: string;

  @Column({ nullable: true })
  phone: string;

  @Column({ nullable: true })
  @Index()
  organisationId: string;

  @ManyToOne(() => Organisation)
  @JoinColumn({ name: 'organisationId' })
  organisation: Organisation;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
