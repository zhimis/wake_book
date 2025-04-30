# Using Same Database with Development and Production Environments

This guide explains how to set up your database to use the same PostgreSQL instance for both development and production, with separate tables for each environment.

## How It Works

1. The application uses a table prefix system based on the `NODE_ENV` environment variable:
   - In development, tables are prefixed with `dev_` (e.g., `dev_users`, `dev_bookings`, etc.)
   - In production, tables are prefixed with `prod_` (e.g., `prod_users`, `prod_bookings`, etc.)

2. When running in development mode (locally), the app uses the development tables
3. When deployed, setting `NODE_ENV=production` makes the app use the production tables

## Setting Up Development Tables

To create or update the development tables, run:

```bash
# First, make sure we're in development mode
export NODE_ENV=development

# Run the migration script
node scripts/setup-dev-db.js

# Or use drizzle directly
npx drizzle-kit push:pg
```

## Setting Up Production Tables

To create or update the production tables, run:

```bash
# First, set production mode
export NODE_ENV=production

# Run the migration script
node scripts/setup-prod-db.js

# Or use drizzle directly
npx drizzle-kit push:pg
```

## Deployment Configuration

When deploying on Replit:

1. Click the "Deploy" button in your Replit project
2. Set up the environment variable:
   - `NODE_ENV=production`
3. Deploy your application

The deployed application will automatically use the production tables (`prod_*`) while your development environment continues to use the development tables (`dev_*`).

## Data Migration

If you need to copy data from development to production tables:

```sql
-- Example for copying users (repeat for each table)
INSERT INTO prod_users (username, password)
SELECT username, password FROM dev_users;
```

## Debugging

If you encounter issues:

1. Check which environment you're in by checking the console output
   - The app logs whether it's running in development or production mode
2. Verify that the appropriate tables exist
   - In psql: `\dt dev_*` and `\dt prod_*`
3. Make sure you've run the appropriate migration script for the environment