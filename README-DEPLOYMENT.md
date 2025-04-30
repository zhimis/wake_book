# Hi Wake 2.0 Deployment Guide

This document explains how to set up separate development and production databases for the Hi Wake 2.0 booking system.

## Environment Configuration

The application is built to support different databases for development and production environments.

### Development Environment

In the development environment:
- The application runs with `NODE_ENV=development` (this is the default)
- It uses the database specified by the `DATABASE_URL` environment variable

### Production Environment

For a production deployment:
1. Set `NODE_ENV=production` in your deployment environment
2. Create a separate production database (ideally on Neon or another PostgreSQL provider)
3. Set the `DATABASE_URL` environment variable to your production database connection string

## Setting Up a Production Database

1. Create a new PostgreSQL database (ideally in Neon)
2. Get the connection string for this database
3. In your production deployment:
   - Set `NODE_ENV=production`
   - Set `DATABASE_URL` to the production database connection string

## Database Migration Steps

After setting up your production database, you'll need to migrate your schema:

```bash
# First, ensure drizzle-kit is installed
npm install -g drizzle-kit

# Set the database URL to your production database
export DATABASE_URL=your_production_database_connection_string

# Push the schema to the production database
npx drizzle-kit push:pg
```

## Data Migration

If you need to migrate data from development to production:

1. Export data from development database:
   ```sql
   COPY users TO '/tmp/users.csv' WITH CSV HEADER;
   COPY operating_hours TO '/tmp/operating_hours.csv' WITH CSV HEADER;
   COPY pricing TO '/tmp/pricing.csv' WITH CSV HEADER;
   COPY configuration TO '/tmp/configuration.csv' WITH CSV HEADER;
   COPY time_slots TO '/tmp/time_slots.csv' WITH CSV HEADER;
   COPY bookings TO '/tmp/bookings.csv' WITH CSV HEADER;
   COPY booking_time_slots TO '/tmp/booking_time_slots.csv' WITH CSV HEADER;
   ```

2. Import data to production database:
   ```sql
   COPY users FROM '/tmp/users.csv' WITH CSV HEADER;
   COPY operating_hours FROM '/tmp/operating_hours.csv' WITH CSV HEADER;
   COPY pricing FROM '/tmp/pricing.csv' WITH CSV HEADER;
   COPY configuration FROM '/tmp/configuration.csv' WITH CSV HEADER;
   COPY time_slots FROM '/tmp/time_slots.csv' WITH CSV HEADER;
   COPY bookings FROM '/tmp/bookings.csv' WITH CSV HEADER;
   COPY booking_time_slots FROM '/tmp/booking_time_slots.csv' WITH CSV HEADER;
   ```

## Replit Deployment Configuration

When deploying on Replit:

1. Click the "Deploy" button in your Replit project
2. Set up your environment variables:
   - `NODE_ENV=production`
   - `DATABASE_URL=your_production_database_url`
3. Deploy your application

This will ensure your production deployment uses the separate production database.