import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

// Determine which database to use based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
console.log(`Running in ${isDevelopment ? 'development' : 'production'} mode`);

// For now, always use DATABASE_URL, but this allows different databases in the future
// by setting NODE_ENV=production and PROD_DATABASE_URL for production deployments
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });
export const db = drizzle(pool, { schema });