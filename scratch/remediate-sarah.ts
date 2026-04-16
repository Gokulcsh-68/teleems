/**
 * One-off remediation script to fix Sarah Miller's missing organization ID.
 */
import 'dotenv/config';
import { DataSource } from 'typeorm';
import { User } from '../apps/auth-service/src/entities/user.entity';

async function remediate() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433', 10),
    username: process.env.DB_USER || 'teleems_user',
    password: process.env.DB_PASSWORD || 'localpassword',
    database: process.env.DB_NAME || 'teleems',
    entities: [User],
  });

  await dataSource.initialize();
  console.log('[REMEDIATE] Connected.');

  const userRepo = dataSource.getRepository(User);
  const sarah = await userRepo.findOneBy({ username: 'sarah_miller_er' });

  if (!sarah) {
    console.error('Sarah Miller not found.');
    return;
  }

  // Assign a static UUID for Apollo General
  const APOLLO_ID = '84c30e99-5112-4be9-8ee7-39d6d4676914';
  sarah.organisationId = APOLLO_ID;
  
  await userRepo.save(sarah);
  console.log(`[REMEDIATE] ✅ Sarah Miller mapped to organization: ${APOLLO_ID}`);

  await dataSource.destroy();
}

remediate().catch(console.error);
