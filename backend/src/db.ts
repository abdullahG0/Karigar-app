import { Pool } from 'pg';
import { getDb } from './database/setup';

// All routes import `db` and call pool.query() on it.
const db: Pool = getDb();
export default db;
