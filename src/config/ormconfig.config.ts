import { TypeOrmModule } from '@nestjs/typeorm';
import 'dotenv/config';

export const ConnectionBD = TypeOrmModule.forRoot({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT, 10),
  username: process.env.DB_USERNAME,
  password: `${process.env.DB_PASSWORD}`,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  logging: process.env.NODE_ENV !== 'production',
  synchronize: false,
  migrationsTableName: 'typeorm_migrations',
  migrationsRun: false,
  extra: {
    timezone: 'UTC',
  },
});
