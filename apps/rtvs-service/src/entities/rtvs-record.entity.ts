import { Entity, PrimaryGeneratedColumn, PrimaryColumn, Column, Index } from 'typeorm';

@Entity({ name: 'rtvs_records' })
export class RtvsRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @PrimaryColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column()
  @Index()
  organisationId: string;

  @Column({ type: 'json' })
  vitals: any;
}
