import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('user_sessions')
export class Session {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column({ default: true })
  isValid: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  expiresAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  lastActiveAt: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
