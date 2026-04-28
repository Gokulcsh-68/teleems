import {
  Entity,
  PrimaryGeneratedColumn,
  PrimaryColumn,
  Column,
  Index,
} from 'typeorm';

@Entity({ name: 'rtvs_records' })
export class RtvsRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @PrimaryColumn({ type: 'timestamptz' })
  timestamp: Date;

  @Column({ name: 'organisation_id' })
  @Index()
  organisationId: string;

  @Column({ name: 'incident_id', nullable: true })
  @Index()
  incidentId: string;

  @Column({ name: 'patient_id', nullable: true })
  @Index()
  patientId: string;

  @Column({ type: 'json' })
  vitals: any;
}
