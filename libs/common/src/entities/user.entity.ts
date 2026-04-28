import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  AfterLoad,
} from 'typeorm';

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

  @Column({ name: 'profile_image', nullable: true })
  profileImage: string;

  profileImageUrl: string | null;

  @AfterLoad()
  computeProfileImageUrl() {
    if (this.profileImage && this.profileImage.trim() !== '') {
      const publicBaseUrl =
        process.env.S3_PUBLIC_BASE_PATH ||
        'https://a2ztelehealth.s3.amazonaws.com/';
      // Use the first role in lowercase as the folder path, default to 'user' if none
      const primaryRole =
        this.roles && this.roles.length > 0
          ? this.roles[0].toLowerCase().replace(/\s+/g, '')
          : 'user';
      const folderPath = `temp/${primaryRole}/`;

      this.profileImageUrl = `${publicBaseUrl}${folderPath}${this.profileImage}`;
    } else {
      this.profileImageUrl = null;
    }
  }

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

  @Column({ name: 'employee_id', nullable: true })
  @Index()
  employeeId: string;

  @Column({ nullable: true })
  department: string;

  @Column({ nullable: true })
  designation: string;

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

  @Column({ name: 'is_available', default: true })
  isAvailable: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
