import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

export enum FeatureFlagScope {
  GLOBAL = 'GLOBAL',
  ORGANISATION = 'ORGANISATION',
  HOSPITAL = 'HOSPITAL',
}

@Entity('feature_flags')
@Index(['name', 'scope', 'scope_id'], { unique: true })
export class FeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  name: string; // e.g. 'ENABLE_TELECONSULT'

  @Column({
    type: 'enum',
    enum: FeatureFlagScope,
    default: FeatureFlagScope.GLOBAL,
  })
  scope: FeatureFlagScope;

  @Column({ name: 'scope_id', type: 'uuid', nullable: true })
  scopeId: string | null;

  @Column({ default: false })
  isEnabled: boolean;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
