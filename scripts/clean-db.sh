#!/bin/bash
# Database cleanup script for Hi Wake 2.0
# This script removes all booking and time slot data while preserving system configuration

echo "Running Hi Wake 2.0 database cleanup script..."

# Get database URL from environment or use default
DB_URL=${DATABASE_URL:-$PGDATABASE}

# Execute the SQL script
psql "$DB_URL" -f scripts/clean-db.sql

echo "Cleanup complete! The system will regenerate time slots when a user accesses the booking page."