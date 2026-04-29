import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum ExportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('epcr_export_jobs')
export class EpcrExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  epcr_id: string;

  @Column({
    type: 'enum',
    enum: ExportJobStatus,
    default: ExportJobStatus.PENDING,
  })
  status: ExportJobStatus;

  @Column({ nullable: true })
  download_url: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: any;

  @Column({ nullable: true })
  error_message: string;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at: Date;
}
