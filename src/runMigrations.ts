import {
  initializeDatabase,
  connectionSource,
} from './shared/utils/datasource';

async function runMigrations() {
  try {
    await initializeDatabase();
    console.log('Database initialized and uuid-ossp extension enabled.');

    await connectionSource.runMigrations();
    console.log('Migrations executed successfully.');
  } catch (error) {
    console.error('Error running migrations:', error);
  } finally {
    await connectionSource.destroy();
  }
}

runMigrations();
