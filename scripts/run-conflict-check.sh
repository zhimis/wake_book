#!/bin/bash

# Script to run the booking conflict detection and resolution

# Check if argument is provided
if [ $# -eq 0 ]; then
  echo "Usage: ./scripts/run-conflict-check.sh [report|fix]"
  echo "  report - Generate a report of all booking conflicts"
  echo "  fix - Fix conflicts by keeping the most recent booking for each time slot"
  exit 1
fi

# Run the appropriate command
if [ "$1" == "report" ]; then
  echo "Generating booking conflict report..."
  npx tsx scripts/fix-booking-conflicts.ts report
elif [ "$1" == "fix" ]; then
  echo "Fixing booking conflicts..."
  npx tsx scripts/fix-booking-conflicts.ts fix
else
  echo "Unknown command: $1"
  echo "Usage: ./scripts/run-conflict-check.sh [report|fix]"
  exit 1
fi