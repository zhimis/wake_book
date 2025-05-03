# Time Handling in Hi Wake 2.0

This document outlines the best practices for time handling in the Hi Wake 2.0 booking system, the current implementation, and a plan to address the inconsistencies.

## Best Practice Setup

### 1. Database Storage
- **Always store timestamps in UTC**: All date/time values in the database should be stored in UTC (Coordinated Universal Time)
- **Use timezone-aware types**: Use PostgreSQL's `TIMESTAMP WITH TIME ZONE` type for all time-related fields
- **Store recurring schedule times with context**: For recurring schedules (operating hours), store not just the time but also the day context and timezone info
- **Never store local times without timezone info**: Avoid storing timestrings like "08:00" without timezone context

### 2. Server-Side Handling
- **Work with UTC in server code**: All date manipulations on the server should happen in UTC
- **Convert to relevant timezone only for business logic**: Only convert times to Latvia timezone when needed for business logic (e.g., checking peak hours)
- **Validate incoming time data**: Explicitly verify and convert any incoming time data to UTC before storing
- **Include timezone info in API responses**: When sending timestamps to the client, include timezone information in ISO format

### 3. Client-Side Handling
- **Single conversion responsibility**: Have a dedicated utility for all timezone conversions
- **Convert all displayed times**: Always convert UTC times from the server to Latvia time (Europe/Riga) before displaying
- **Convert all input times**: Always convert user input times from Latvia time to UTC before sending to the server
- **Consistent date/time formatting**: Use consistent formatting across the application

## Current Situation

### Database Issues
- Timestamps are stored as UTC, which is correct
- Operating hours are stored as string time values (e.g., "08:00", "22:00") without timezone context
- No consistency in how timezone information is handled during time slot generation
- No explicit timezone conversions when saving/loading times to/from the database

### Server Issues
- Inconsistent handling of timezone conversions in API endpoints
- Time slot generation doesn't clearly account for timezone differences
- Booking features may have timezone inconsistencies that could lead to incorrect business logic

### Client Issues
- Some components properly convert to Latvia time (calendar views)
- Others don't apply the conversions (admin config screen)
- Inconsistent use of the timezone utility functions across components
- Manual timezone adjustments in some places (+3 hours) rather than proper conversion

### Specific Examples of Inconsistencies
- Admin calendar shows slots at 13:00 Latvia time correctly
- Admin config screen shows equivalent time as 10:00 (UTC) incorrectly
- Booking time displays may vary across different components
- Time slot generation may not be correctly accounting for timezone differences

## Plan to Fix

### 1. Database and Schema Adjustments

**Task 1.1: Update Operating Hours Schema**
- Modify the `operating_hours` table to use proper time types with timezone info
- Create a migration script that converts existing operating hours string times to UTC timestamps

```sql
-- Example migration (DO NOT EXECUTE YET)
ALTER TABLE operating_hours
ADD COLUMN open_time_utc TIMESTAMP WITH TIME ZONE,
ADD COLUMN close_time_utc TIMESTAMP WITH TIME ZONE;

-- Convert existing data using a context date (e.g., 2025-01-01)
UPDATE operating_hours
SET open_time_utc = '2025-01-01T' || open_time || ':00+00:00',
    close_time_utc = '2025-01-01T' || close_time || ':00+00:00';

-- After verifying data
ALTER TABLE operating_hours
DROP COLUMN open_time,
DROP COLUMN close_time;

ALTER TABLE operating_hours
RENAME COLUMN open_time_utc TO open_time;

ALTER TABLE operating_hours
RENAME COLUMN close_time_utc TO close_time;
```

**Task 1.2: Verify Existing Time Slot Data**
- Analyze existing time slots to ensure their UTC times are correct
- Create a data verification script to check for any timezone inconsistencies
- Document any findings that may require manual adjustments

### 2. Server-Side Improvements

**Task 2.1: Standardize Server Date/Time Utilities**
- Create a dedicated server-side timezone utility module (e.g., `server/utils/timezone.ts`)
- Implement Latvia timezone conversions consistently for all server operations
- Add functions to validate and sanitize incoming time data

**Task 2.2: Update Time Slot Generation Logic**
- Refactor the time slot generation code to properly respect timezone differences
- Ensure that all generated time slots have correct UTC timestamps
- Add validation to prevent timezone-related errors

**Task 2.3: Update API Endpoints**
- Review and update all API endpoints that handle time data
- Ensure consistent handling of time formats in request/response handling
- Standardize error handling for time-related issues

### 3. Client-Side Improvements

**Task 3.1: Standardize Client Date/Time Utilities**
- Enhance the existing `toLatviaTime` and `formatInLatviaTime` functions
- Add new utility functions for converting from Latvia time to UTC
- Create a date/time formatter factory for consistent display

**Task 3.2: Update Components for Consistent Time Handling**
- Update all components to use the standardized time utility functions
- Remove any manual timezone adjustments or string manipulations
- Ensure consistent time display across all components

**Task 3.3: UI Improvements**
- Add timezone indicators to all time displays (e.g., "13:00 (Latvia time)")
- Create a consistent time input component for use across the application
- Add validation for time inputs to prevent timezone confusion

### 4. Testing and Validation

**Task 4.1: Create Timezone Test Cases**
- Develop specific test cases for timezone handling
- Include edge cases like daylight saving time transitions

**Task 4.2: UI Testing**
- Manually test all time displays and inputs across the application
- Verify consistency between admin and customer-facing views

**Task 4.3: Automated Testing**
- Add automated tests for timezone conversions
- Implement integration tests for time-related features

### 5. Documentation and Training

**Task 5.1: Update Developer Documentation**
- Document the timezone handling approach
- Create a guide for developers on how to properly handle times

**Task 5.2: Create User Documentation**
- Clarify timezone handling in user-facing documentation
- Create clear instructions for admins regarding timezone considerations

## Implementation Order

1. Start with client-side utility standardization (Task 3.1)
2. Implement server-side utilities (Task 2.1)
3. Update components one by one for consistent handling (Task 3.2)
4. Test thoroughly after each component update
5. Plan and execute database schema updates (Tasks 1.1, 1.2)
6. Update time slot generation logic (Task 2.2)
7. Update remaining API endpoints (Task 2.3)
8. Implement UI improvements (Task 3.3)
9. Perform comprehensive testing (Tasks 4.1-4.3)
10. Update documentation (Tasks 5.1, 5.2)

## Considerations for Production Data

Since the system is already in production, special care must be taken with database migrations:

1. **Backup All Data**: Create a full database backup before any schema changes
2. **Test Migrations**: Test all migrations in a staging environment first
3. **Schedule Maintenance Window**: Perform changes during low-usage periods
4. **Prepare Rollback Plan**: Have a detailed rollback plan ready in case of issues
5. **Monitor After Deployment**: Closely monitor the system after changes are applied

## Conclusion

Implementing a consistent approach to timezone handling will resolve the current inconsistencies and prevent future issues. The plan focuses on standardization across all layers of the application while ensuring minimal disruption to the production environment.