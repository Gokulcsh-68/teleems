import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

export enum HospitalSystemStatus {
  GREEN = 'GREEN', // Open / Ready
  ORANGE = 'ORANGE', // High Load
  RED = 'RED', // Diverting / Full
}

@Entity('hospital_status')
export class HospitalStatus {
  @PrimaryColumn('uuid')
  hospitalId: string;

  @Column({
    type: 'jsonb',
    default: {
      icu: { total: 0, available: 0 },
      general: { total: 0, available: 0 },
      isolation: { total: 0, available: 0 },
    },
  })
  beds: {
    icu: { total: number; available: number };
    general: { total: number; available: number };
    isolation: { total: number; available: number };
  };

  @Column({
    type: 'jsonb',
    default: {
      ventilators: { total: 0, available: 0 },
      ecmo: { total: 0, available: 0 },
    },
  })
  equipment: {
    ventilators: { total: number; available: number };
    ecmo: { total: number; available: number };
  };

  @Column({
    type: 'enum',
    enum: HospitalSystemStatus,
    default: HospitalSystemStatus.GREEN,
  })
  systemStatus: HospitalSystemStatus;

  @Column({ nullable: true })
  updatedBy: string; // userId of the last person to update

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
