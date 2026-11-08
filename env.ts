// Loads settings from .env.local and .env BEFORE any other server module is read.
// (ES-module imports are evaluated before the body of server.ts, so this must be the first import.)
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();
if (process.argv.includes('--prod') && !process.env.NODE_ENV) process.env.NODE_ENV = 'production';
