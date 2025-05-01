-- Database cleanup script for Hi Wake 2.0
-- This script removes all booking and time slot data while preserving system configuration

-- Show counts before cleanup
SELECT 'Before cleanup:' AS "Status";
SELECT 'Time slots count: ' || COUNT(*) FROM time_slots;
SELECT 'Bookings count: ' || COUNT(*) FROM bookings;
SELECT 'Booking time slots count: ' || COUNT(*) FROM booking_time_slots;

-- Start transaction for safety
BEGIN;

-- Delete data in the correct order to respect foreign key constraints
DELETE FROM booking_time_slots;
DELETE FROM bookings;
DELETE FROM time_slots;

-- Show counts after cleanup
SELECT 'After cleanup:' AS "Status";
SELECT 'Time slots count: ' || COUNT(*) FROM time_slots;
SELECT 'Bookings count: ' || COUNT(*) FROM bookings;
SELECT 'Booking time slots count: ' || COUNT(*) FROM booking_time_slots;

-- Commit the transaction (remove this line to do a dry run)
COMMIT;

-- Note: The system will regenerate time slots when a user accesses the booking page