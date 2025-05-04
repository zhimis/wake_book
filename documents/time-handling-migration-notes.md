# Timezone Migration Notes

## Analysis Results

We've completed a thorough analysis of timezone handling in the system and identified several issues to be addressed:

1. The database analysis script found:
   - 61 time slot issues (mostly slots outside operating hours)
   - 7 operating hours format issues (times stored with seconds)
   - No issues found with bookings data

2. Migration test scripts have been developed and tested for:
   - Operating hours schema migration
   - Time slot schema migration

3. Each migration includes SQL statements that will:
   - Create new tables with enhanced timezone-aware schemas
   - Migrate existing data with appropriate timezone information
   - Update time formats for consistency

## Key Learnings from Testing

### Timezone Display Flow
The correct flow for timezone handling is:

1. **Database Storage (Always UTC)**:
   ```typescript
   const timeSlotInUTC = new Date('2025-05-03T10:30:00Z'); // Stored in DB
   ```

2. **Display to User (Latvia Timezone)**:
   ```typescript
   const displayTime = formatInTimeZone(
     timeSlotInUTC,
     'Europe/Riga',
     'yyyy-MM-dd HH:mm:ss z'
   ); // Shows as "2025-05-03 13:30:00 GMT+3"
   ```

3. **User Input (Latvia Timezone)**:
   ```typescript
   // User selects date and time in Latvia timezone (UI)
   const userSelectedTime = new Date('2025-05-03T13:30:00+03:00');
   ```

4. **Convert Back to UTC for Storage**:
   ```typescript
   const timeForStorage = fromLatviaTime(userSelectedTime); // Stored as UTC
   ```

### Potential Pitfalls Identified

1. **Time Conversion Confusion**: 
   - The initial round-trip test failed because we were converting UTC→Latvia→UTC incorrectly
   - Timezone offset must be appropriately handled when storing and retrieving times

2. **Time Format Inconsistency**:
   - Operating hours are stored with seconds (e.g., "10:00:00") but displayed without them
   - Migration will standardize to HH:MM format

3. **Operating Hours Timezone Context**:
   - Operating hours need explicit timezone context
   - The migration will add a timezone field and local time flag

## Schema Design Updates

1. **Time Slots**:
   - Add timestamp with timezone (TIMESTAMPTZ) type for dates
   - Add explicit storage_timezone field defaulting to 'UTC'

2. **Operating Hours**:
   - Add timezone field defaulting to 'Europe/Riga'
   - Add useLocalTime flag for special scenarios
   - Standardize time format to HH:MM

3. **Time Format Preferences**:
   - New table for system-wide time formatting preferences
   - Control 24h vs 12h display, timezone indicators, etc.

## Migration Process Overview

1. **Preparation**:
   - Document all schema changes (completed)
   - Create and test migration scripts (completed)
   - Backup database before migration

2. **Migration Execution**:
   - Run migration in a maintenance window
   - Verify data integrity after migration

3. **Code Updates**:
   - Update application code to use new schema
   - Enhance timezone display based on user preferences
   - Implement better validation for timezone-aware operations

## Next Steps

1. **Review & Approval**:
   - Review migration plan with stakeholders
   - Schedule a maintenance window for implementation

2. **Application Updates**:
   - Update time slot generator to use explicit timezone handling
   - Update frontend components to display appropriate timezone context

3. **Post-Migration Validation**:
   - Verify all time calculations with new schema
   - Test booking process across timezone boundaries
   - Run comprehensive end-to-end tests