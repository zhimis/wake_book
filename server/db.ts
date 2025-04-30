import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Determine which database URL to use based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
const databaseUrl = isDevelopment 
  ? process.env.DEV_DATABASE_URL || process.env.DATABASE_URL
  : process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "Database URL must be set. Did you forget to provision a database?",
  );
}

console.log(`Using ${isDevelopment ? 'development' : 'production'} database connection`);

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });