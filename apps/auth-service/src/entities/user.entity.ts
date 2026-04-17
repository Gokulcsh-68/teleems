import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  phone: string;

  @Column({ type: 'simple-array', default: 'CALLER' })
  roles: string[];
  
  @Column({ nullable: true })
  name: string;

  @Column({ default: 'ACTIVE' })
  status: 'ACTIVE' | 'INACTIVE' | 'LOCKED' | 'PENDING';

  @Column({ name: 'organisation_id', nullable: true })
  organisationId: string;

  @Column({ name: 'hospital_id', nullable: true })
  hospitalId: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'timestamptz', nullable: true })
  tokensRevokedAt: Date;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ nullable: true, select: false })
  password: string;

  // --- MFA Fields (Spec 5.1) ---

  @Column({ nullable: true, select: false })
  mfaSecret: string;

  @Column({ default: false })
  mfaEnabled: boolean;

  @Column({ type: 'simple-json', nullable: true, select: false })
  mfaBackupCodes: string[];

  // --- Admin Lifecycle Fields (Spec 5.1) ---

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ default: false })
  forcePasswordReset: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastActiveAt: Date;

  @Column({ default: 0 })
  failedLoginAttempts: number;

  @Column({ type: 'timestamptz', nullable: true })
  lockedUntil: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
