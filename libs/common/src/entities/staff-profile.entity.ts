import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum StaffType {
  DRIVER = 'DRIVER',
  EMT = 'EMT',
  DOCTOR = 'DOCTOR',
  HEALTH_AID = 'HEALTH_AID'
}

export enum StaffStatus {
  ACTIVE = 'ACTIVE',
  ON_LEAVE = 'ON_LEAVE',
  SICK_LEAVE = 'SICK_LEAVE',
  ABSENT = 'ABSENT',
  INACTIVE = 'INACTIVE'
}

@Entity('staff_profiles')
export class StaffProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  @Index({ unique: true })
  userId: string;

  // Since User entity is in auth-service, we link via ID
  // In a real microservices env, this would be a GUID reference.
  
  @Column({
    type: 'enum',
    enum: StaffType,
    default: StaffType.EMT
  })
  @Index()
  type: StaffType;

  @Column({
    type: 'enum',
    enum: StaffStatus,
    default: StaffStatus.ACTIVE
  })
  @Index()
  status: StaffStatus;

  @Column({ name: 'organisation_id', type: 'uuid', nullable: true })
  @Index()
  organisationId: string;

  // --- General Information ---
  @Column({ nullable: true })
  aadhaar_number: string;

  @Column({ type: 'date', nullable: true })
  dob: Date;

  @Column({ nullable: true })
  gender: string;

  @Column({ nullable: true })
  photo_url: string;

  @Column({ nullable: true })
  blood_group: string;

  @Column({ nullable: true })
  emergency_contact_phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  // --- Professional Details (Dynamic based on type) ---
  @Column({ type: 'jsonb', nullable: true })
  professional_details: {
    // Driver fields
    license_number?: string;
    license_category?: string;
    license_expiry?: string;
    license_upload_url?: string;
    
    // EMT / Doctor fields
    qualification?: string;
    certification_body?: string;
    certificate_number?: string;
    certificate_expiry?: string;
    specialization?: string;
    professional_license_url?: string;
    
    // Doctor only
    medical_registration_number?: string;
    teleconsult_available?: boolean;
  };

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
