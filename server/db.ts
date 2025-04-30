import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Determine which database to use based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isDevelopment ? 'development' : 'production'} mode`);

// Use different database URLs based on environment 
// DEV_DATABASE_URL is used for development
// PROD_DATABASE_URL is used for production
// If specific URLs aren't available, fall back to DATABASE_URL
let databaseUrl;

if (isDevelopment) {
  databaseUrl = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL;
  console.log('Using development database connection');
} else {
  databaseUrl = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
  console.log('Using production database connection');
}

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });