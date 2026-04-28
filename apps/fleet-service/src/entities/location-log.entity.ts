import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('vehicle_location_logs')
export class LocationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  vehicle_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 7 })
  longitude: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  speed: number;

  @Column()
  @Index()
  organisationId: string;

  @CreateDateColumn({ type: 'timestamptz' })
  @Index()
  timestamp: Date;
}
