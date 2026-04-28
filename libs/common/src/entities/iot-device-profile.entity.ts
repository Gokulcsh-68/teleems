import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('iot_device_profiles')
export class IotDeviceProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  model_name: string;

  @Column()
  firmware_version: string;

  @Column({ default: 'QR' })
  pairing_logic: string; // 'QR', 'CODE', 'NFC'

  @Column({ type: 'jsonb', nullable: true })
  capabilities: {
    vitals_streaming: boolean;
    gps_tracking: boolean;
    two_way_audio: boolean;
    network_types: string[]; // ['4G', '5G', 'SAT']
  };

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
