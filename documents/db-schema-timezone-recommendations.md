# Database Schema Timezone Recommendations

## Analysis Results
This document contains the findings from our database analysis for timezone-related issues and recommendations for schema changes.

### Time Slot Issues
- **Outside Operating Hours (61 issues)**: Many time slots have times that fall outside the configured operating hours in Latvia time. Most of these appear to be midnight or late evening slots that may be intended for the next day.
  
### Operating Hours Issues
- **Invalid Time Format (7 issues)**: All operating hours records have time formats with seconds (e.g., "11:00:00" instead of "11:00"). While this works, it's inconsistent with the UI presentation format.

### Booking Issues
- No issues found with bookings or their time slots, which is good news!

## Schema Change Recommendations

### 1. Add Explicit Timezone Field to TimeSlots Table

**Current Schema:**
```typescript
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  price: numeric("price").notNull(),
  reservationExpiry: timestamp("reservation_expiry"),
});
```

**Proposed Schema:**
```typescript
export const timeSlots = pgTable("time_slots", {
  id: serial("id").primaryKey(),
  status: text("status").notNull(),
  startTime: timestamp("start_time", { withTimezone: true }).notNull(), // Add timezone
  endTime: timestamp("end_time", { withTimezone: true }).notNull(), // Add timezone
  price: numeric("price").notNull(),
  reservationExpiry: timestamp("reservation_expiry", { withTimezone: true }), // Add timezone
  storageTimezone: text("storage_timezone").default("UTC").notNull(), // Add explicit storage timezone field
});
```

### 2. Add Timezone Awareness to Operating Hours

**Current Schema:**
```typescript
export const operatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
});
```

**Proposed Schema:**
```typescript
export const operatingHours = pgTable("operating_hours", {
  id: serial("id").primaryKey(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6 (Sunday-Saturday)
  openTime: text("open_time").notNull(),
  closeTime: text("close_time").notNull(),
  isClosed: boolean("is_closed").notNull().default(false),
  timezone: text("timezone").default("Europe/Riga").notNull(), // Add timezone field
  useLocalTime: boolean("use_local_time").default(false).notNull(), // For special events with non-Latvia time
});
```

### 3. Add Time Formatting Configuration Table

**Proposed New Schema:**
```typescript
export const timeFormatPreferences = pgTable("time_format_preferences", {
  id: serial("id").primaryKey(),
  use24HourFormat: boolean("use_24_hour_format").default(true).notNull(),
  showTimezoneIndicator: boolean("show_timezone_indicator").default(true).notNull(),
  dateFormat: text("date_format").default("dd.MM.yyyy").notNull(), // EU format by default
  timeFormat: text("time_format").default("HH:mm").notNull(), // 24hr format by default
  defaultTimezone: text("default_timezone").default("Europe/Riga").notNull(),
});
```

### 4. Create Database Constraint for Time Slot Duration

Rather than a schema change, we recommend adding validation at the application level to ensure all time slots are exactly 30 minutes. This can be implemented in:

1. The time slot generator function to ensure all generated slots have the correct duration
2. The time slot creation endpoint to validate slot duration before saving
3. The UI components to prevent users from creating slots with incorrect durations

## Migration Plan

1. **Preparation Phase**
   - Run full database backup
   - Create test migration scripts
   - Verify all migrations on test data

2. **Schema Updates**
   - Add the new fields to existing tables as nullable first
   - Update the application code to use the new fields
   - Backfill data for existing records

3. **Data Migration**
   - Standardize all timestamps to UTC with explicit timezone information
   - Update operating hours to include timezone information
   - Clean up any time format inconsistencies

4. **Application Updates**
   - Update all database queries to work with the new schema
   - Update time slot generator to use timezone information correctly
   - Update UI to display timezone indicators as needed

5. **Verification**
   - Verify all time calculations before/after migration
   - Test booking process under different client timezones
   - Monitor for any timezone-related issues

## Implications for Frontend Components

The schema changes will require updates to several frontend components:

1. `BookingCalendar` - Update to show timezone indicators based on configuration
2. `TimeSlot` - Display times with appropriate timezone context
3. `BookingForm` - Add timezone information to user-facing components
4. `AdminCalendarView` - Update to handle timezone-aware operations

## Next Steps

1. Create database migration script for the schema changes
2. Update timezone utility functions to work with new schema
3. Modify time slot generator to explicitly handle timezone information
4. Update frontend components to display timezone context when needed