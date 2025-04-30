# Hi Wake 2.0 Deployment Guide

This document outlines the steps needed to deploy the Hi Wake 2.0 Wakeboarding Park Booking System, with particular focus on database configuration for development and production environments.

## Database Environment Configuration

The application is designed to support separate databases for development and production environments to ensure clean separation of concerns.

### Environment Variables

The following environment variables control the database connections:

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Default database connection string | Yes |
| `DEV_DATABASE_URL` | Development-specific database connection | No |
| `PROD_DATABASE_URL` | Production-specific database connection | No |
| `NODE_ENV` | Environment setting (`development` or `production`) | Yes |

### Connection Logic

1. If `NODE_ENV=development`:
   - The app will attempt to use `DEV_DATABASE_URL` first
   - If not available, it falls back to `DATABASE_URL`

2. If `NODE_ENV=production`:
   - The app will attempt to use `PROD_DATABASE_URL` first
   - If not available, it falls back to `DATABASE_URL`

## Development Setup

For local development:

1. Set `NODE_ENV=development` in your environment
2. Optionally, set `DEV_DATABASE_URL` to point to a development-specific database
3. Run the application with `npm run dev`

## Production Deployment

When deploying to production:

1. Set `NODE_ENV=production` in your environment
2. Set `PROD_DATABASE_URL` to point to your production database
3. Build the application with `npm run build`
4. Start the application with `npm run start`

### Deploying on Replit

1. Click the "Deploy" button in your Replit project
2. Configure the following environment variables:
   - `NODE_ENV`: Set to `production`
   - `PROD_DATABASE_URL`: Your production database URL (or leave unset to use `DATABASE_URL`)
3. Deploy your application

## Database Migration

When you need to apply schema changes:

```bash
# For development database
NODE_ENV=development npx drizzle-kit push:pg

# For production database
NODE_ENV=production npx drizzle-kit push:pg
```

## Separate Database Strategy vs. Single Database with Prefixes

Two approaches were considered for separating development and production data:

1. **Separate Databases (Recommended)**: 
   - Complete isolation between environments
   - Independent scaling and backup strategies
   - Cleaner security boundaries

2. **Single Database with Table Prefixes**:
   - Uses table name prefixes (`dev_` or `prod_`) in the same database
   - Requires fewer database resources
   - More complex table management

The current implementation uses the separate databases approach for cleaner separation and simpler development.

## Troubleshooting

- If you encounter database connection issues, verify that the appropriate environment variables are set
- Check the console logs to confirm which database connection the application is using
- For database schema issues, run the appropriate migration commands