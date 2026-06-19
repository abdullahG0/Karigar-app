// Standalone seed script — wipes the database file and inserts fresh seed data.
// Run: npx ts-node src/scripts/seed.ts  (from the backend/ directory)
import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH
  ? path.resolve(process.env.DB_PATH)
  : path.resolve('./database.sqlite');

// Remove WAL/SHM files first, then the main database.
for (const ext of ['-wal', '-shm', '']) {
  const p = dbPath + ext;
  if (fs.existsSync(p)) {
    fs.unlinkSync(p);
    console.log(`[seed] Removed ${path.basename(p)}`);
  }
}

// require() after the delete so getDb() opens a brand-new file.
/* eslint-disable @typescript-eslint/no-var-requires */
const { getDb }       = require('../database/setup')  as { getDb: () => unknown };
const { seedIfEmpty } = require('../database/seed')   as { seedIfEmpty: () => void };
/* eslint-enable @typescript-eslint/no-var-requires */

getDb();
seedIfEmpty();
