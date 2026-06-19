// Shim: routes that do `import db from '../db'` get the live Database instance.
// The singleton is initialised by the time any route module is required
// because index.ts imports dotenv/config first.
import { getDb } from './database/setup';

export default getDb();
