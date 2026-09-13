import { DataSource } from 'typeorm';
import { join } from 'path';
import 'dotenv/config';

export const connectionSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: `${process.env.DB_PASSWORD}`,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  logging: true,
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [join(__dirname, '/../../', 'database/migrations/**/*{.ts,.js}')],
  synchronize: false,
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
  extra: {
    timezone: 'UTC',
  },
});

export async function initializeDatabase() {
  await connectionSource.initialize();

  await connectionSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`);
}
