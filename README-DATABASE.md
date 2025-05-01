# Hi Wake 2.0 Database Maintenance

This document explains how to perform common database maintenance tasks for the Hi Wake 2.0 Wakeboarding Park Booking System.

## Cleaning Database Data

The project includes several options for cleaning booking and time slot data, which is useful for:
- Setting up a fresh testing environment
- Preparing for demo sessions
- Resetting the system after testing

### Option 1: Using the SQL script directly

Run the SQL script with any PostgreSQL client:

```bash
psql $DATABASE_URL -f scripts/clean-db.sql
```

### Option 2: Using the shell script

```bash
bash scripts/clean-db.sh
```

### Option 3: Using the JavaScript script

```bash
NODE_ENV=development node scripts/clean-db.js
```

## What Gets Cleaned

The cleanup scripts remove:
- All time slots
- All bookings
- All booking time slot relationships

The following data is preserved:
- User accounts
- System configuration
- Operating hours settings
- Pricing configuration

## Regenerating Time Slots

After cleaning the database:
1. The system will automatically regenerate time slots when a user accesses the booking page
2. Alternatively, you can trigger regeneration through the admin interface by clicking "Regenerate Slots"

## Environment-Specific Cleanup

If you're using separate databases for development and production (as described in README-DEPLOYMENT.md), you can target a specific environment:

```bash
# Clean development database
NODE_ENV=development node scripts/clean-db.js

# Clean production database
NODE_ENV=production node scripts/clean-db.js
```

## Database Backup (Optional)

Before cleaning the database, you might want to create a backup:

```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

You can restore the backup if needed:

```bash
psql $DATABASE_URL < backup_filename.sql
```