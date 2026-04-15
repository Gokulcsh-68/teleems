import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../../apps/auth-service/src/entities/user.entity';
import { AuditLog } from '../../apps/auth-service/src/entities/audit-log.entity';
import { RtvsRecord } from '../../apps/rtvs-service/src/entities/rtvs-record.entity';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'teleems_user',
  password: process.env.DB_PASSWORD || 'localpassword',
  database: process.env.DB_NAME || 'teleems',
  synchronize: false,
  logging: true,
  entities: [User, AuditLog, RtvsRecord],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
