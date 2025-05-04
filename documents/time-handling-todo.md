# Hi Wake 2.0 Time Handling Implementation Checklist

This checklist provides a step-by-step implementation plan for fixing the timezone handling issues in Hi Wake 2.0. The tasks are arranged in order of least intrusive to most intrusive, allowing for gradual implementation with minimal risk to the production system.

## Phase 1: Preparation and Utility Development (No Production Impact)

- [x] **Task 3.1.1**: Audit all existing time utility functions in `client/src/lib/utils.ts` ✓
- [x] **Task 3.1.2**: Add a new `fromLatviaTime` function to convert Latvia time to UTC ✓
- [x] **Task 3.1.3**: Create timezone formatting utilities with explicit timezone indication ✓
- [x] **Task 5.1.1**: Document the timezone conversion approach for developers ✓

## Phase 2: Client-Side Non-Intrusive Updates

- [x] **Task 3.2.1**: Update booking-calendar.tsx to use standard time utilities consistently ✓
- [x] **Task 3.2.2**: Update admin-calendar-view.tsx for consistent time handling ✓
- [x] **Task 3.2.3**: Ensure system-config.tsx properly handles time conversions ✓
- [x] **Task 3.2.4**: Update booking-form.tsx to use standard time utilities ✓
- [x] **Task 3.2.5**: Update confirmation-page.tsx to use standard time utilities ✓
- [ ] **Task 4.2.1**: Manually test the updated components across all views

## Phase 3: Server-Side Non-Intrusive Improvements

- [x] **Task 2.1.1**: Create server-side timezone utility module in `server/utils/timezone.ts` ✓
- [x] **Task 2.1.2**: Add functions for Latvia/UTC conversions on the server ✓
- [x] **Task 2.1.3**: Add time validation and sanitization functions ✓
- [x] **Task 2.1.4**: Evaluate migration from date-fns to Luxon for more robust timezone handling ✓
- [x] **Task 2.3.1**: Update GET API endpoints to consistently format time responses ✓
- [x] **Task 2.3.2**: Update the booking creation endpoint for consistent time handling ✓
- [x] **Task 4.1.1**: Create basic test cases for timezone handling functions ✓

## Phase 4: Enhanced Validation & UI Improvements (Low Impact)

- [x] **Task 3.3.1**: Add timezone indicators to time displays (e.g., "13:00 (Latvia time)") ✓
- [x] **Task 3.3.2**: Implement consistent time input validation ✓
- [x] **Task 3.3.3**: Add tooltip explanations for timezone handling where appropriate ✓
- [x] **Task 5.2.1**: Create user documentation regarding timezone handling ✓
- [x] **Task 4.2.2**: Test UI improvements and validate consistent display ✓

## Phase 5: Time Slot Generation Logic Updates (Medium Impact)

- [x] **Task 2.2.1**: Create a new timezone-aware time slot generation function ✓
- [x] **Task 2.2.2**: Update the time slot regeneration endpoint to use the new function ✓
- [x] **Task 2.2.3**: Ensure all time-based business logic correctly uses timezone context ✓
- [x] **Task 4.3.1**: Add tests for time slot generation edge cases ✓
- [x] **Task 4.2.3**: Manually verify time slot generation across multiple days/times ✓

## Phase 6: Database Schema Planning (No Direct Impact)

- [x] **Task 1.2.1**: Create script to analyze existing time slot data consistency ✓
- [x] **Task 1.2.2**: Document any inconsistencies found in production data ✓
- [x] **Task 1.1.1**: Develop and test the operating hours schema migration script ✓
- [x] **Task 5.1.2**: Document the database schema changes and migration process ✓
- [x] **Task 4.1.2**: Create test cases for the migration process on test data ✓

## Phase 7: Database Migration Implementation (Highest Impact)

- [ ] **Task 7.1**: Schedule a maintenance window for database updates
- [ ] **Task 7.2**: Back up the production database completely
- [ ] **Task 1.1.2**: Execute the operating hours schema migration
- [ ] **Task 1.1.3**: Execute the time slots schema migration 
- [ ] **Task 1.1.4**: Create and populate the time format preferences table
- [ ] **Task 7.3**: Update all related server code to work with the new schema
- [ ] **Task 7.4**: Verify all application functionality after migration
- [ ] **Task 4.3.2**: Run full application test suite after migration

## Phase 8: Final Validation and Documentation

- [ ] **Task 4.2.4**: Perform comprehensive end-to-end testing of all time-related features
- [ ] **Task 4.3.3**: Add automated tests for timezone handling during DST transitions
- [ ] **Task 5.1.3**: Finalize developer documentation with lessons learned
- [ ] **Task 5.2.2**: Update admin guides with timezone best practices
- [ ] **Task 8.1**: Monitor production for any timezone-related issues for 2 weeks

## Implementation Notes

1. **Incremental Approach**: Each task should be completed, tested, and verified before moving to the next.
2. **Validation**: After each phase, run tests to verify that the changes have not introduced new issues.
3. **Rollback Plan**: Have a rollback strategy ready for each phase, especially Phases 5-7.
4. **Production Impact**: Phases 1-4 can be done with minimal risk to production. Phase 7 requires careful planning and a maintenance window.
5. **Testing**: All changes should be thoroughly tested in a staging environment before applying to production.

## Completion Criteria

The implementation is considered complete when:

1. All timestamps are consistently handled across the application
2. All time displays clearly indicate their timezone context
3. Database schema properly supports timezone-aware operations
4. All automated tests pass consistently
5. Documentation is complete and up-to-date
6. No timezone-related issues are observed in production for 2 weeks after Phase 8