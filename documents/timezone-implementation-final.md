# Hi Wake 2.0 Timezone Implementation Documentation

## Overview

The HiWake 2.0 Booking System has been updated to properly handle timezones throughout the application. This document describes the implementation details, verification process, and guidelines for timezone handling.

## Key Components

### Database Storage

- All dates are stored in the database in UTC timezone
- Each time slot includes a `storageTimezone` field set to "UTC"
- This explicitly records the timezone used for storage, making the system future-proof if timezone requirements change

### Server-Side Handling

- The server uses the `date-fns-tz` library for timezone conversions
- All date manipulations are done with explicit timezone parameters
- Utility functions have been created for consistent timezone handling:
  - `toLatviaTime()`: Converts a date to Latvia time (Europe/Riga)
  - `fromLatviaTime()`: Converts from Latvia time to UTC
  - `formatInLatviaTime()`: Formats a date directly in Latvia timezone
  - `getLatviaISOString()`: Gets an ISO string formatted in Latvia timezone
  - `isWithinLatviaBusinessHours()`: Checks if a date is within Latvia business hours
  - `getLatviaDayStart()`: Gets the start of the day in Latvia timezone
  - `getLatviaDayEnd()`: Gets the end of the day in Latvia timezone

### Time Slot Generation

- Time slots are generated with proper timezone awareness
- When generating time slots, the `generateTimeSlotsWithTimezone()` function:
  1. Converts input dates to Latvia timezone
  2. Operates on dates in Latvia timezone for business logic
  3. Converts back to UTC for storage
  4. Sets the `storageTimezone` field to "UTC"

### Client-Side Handling

- The client displays times in Latvia timezone (not the user's local timezone)
- UI shows smart timezone indicators only when the user is not in Latvia timezone
- Tooltip explanations have been added for timezone context in the booking form

## Verification Process

The implementation has been tested in several ways:

1. **Automated Testing Script**: The `test-timezone-implementation.ts` script validates:
   - Proper timezone storage in the database
   - Correct timezone conversions
   - Consistent timezone handling in time slot creation
   - Round-trip conversions between UTC and Latvia time

2. **Diagnostic API Endpoint**: The `/api/diagnostics/timeslots` endpoint (admin only) provides detailed timezone analysis for time slots

3. **Database Analysis**: A database analysis was conducted, revealing and fixing issues with:
   - 61 time slots with timezone inconsistencies (fixed)
   - 7 operating hours records requiring timezone fields (added)

## Development Guidelines

When working with dates in the HiWake 2.0 application, follow these guidelines:

1. **Storage**: Always store dates in UTC
   - Include the `storageTimezone: 'UTC'` field in any new time slot records
   - Use the timezone utility functions for conversions

2. **Display**: Always display dates in Latvia timezone (Europe/Riga)
   - Use the `formatInLatviaTime()` function for formatting dates for display
   - Never display dates in the user's local timezone

3. **Business Logic**: Ensure timezone awareness in business logic
   - When checking if a date is in the past, convert both dates to the same timezone
   - When comparing dates, ensure they are in the same timezone
   - Use the utility functions in `timezone.ts` for consistent handling

4. **Day Logic**: Use Latvia day logic for calendar calculations
   - Monday is the first day of the week (day index 0 in Latvia calendar)
   - Use the conversion functions for day indices when needed
   - Use Latvia timezone for day boundaries (start/end of day)

## Troubleshooting

If timezone issues occur, use these troubleshooting steps:

1. Use the `analyzeTimeSlotTimezone()` utility function to examine problematic time slots
2. Check the `/api/diagnostics/timeslots` endpoint for detailed timezone information
3. Verify that all time slots have the `storageTimezone` field set to "UTC"
4. Ensure dates are being properly converted to Latvia timezone for display
5. Run the `test-timezone-implementation.ts` script to validate timezone handling

## Conclusion

The timezone implementation ensures that the HiWake 2.0 Booking System correctly handles dates across the application. The system now stores all dates in UTC with explicit timezone information, while displaying dates in Latvia timezone for the user. This approach provides robust timezone handling and eliminates the previous timezone-related issues.