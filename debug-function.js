// Diagnostic function to check June 1st booking
async function checkJune1stBooking() {
  try {
    // Fetch time slots for June 1st week
    const response = await fetch('/api/timeslots?startDate=2025-06-01T00:00:00.000Z&endDate=2025-06-09T00:00:00.000Z');
    const data = await response.json();
    
    // Find our specific booking
    const juneFirstBooking = 'WB-L_7LG1SG';
    const targetSlots = data.timeSlots.filter(slot => 
      slot.bookingReference === juneFirstBooking
    );
    
    console.log(`Found ${targetSlots.length} slots for June 1st booking:`, targetSlots);
    
    // Check each slot's date and day
    targetSlots.forEach(slot => {
      const date = new Date(slot.startTime);
      console.log(`Slot ${slot.id}: ${date.toISOString()}, JS Day: ${date.getDay()} (0=Sunday)`);
    });
    
    // Sort into day buckets
    const days = {};
    targetSlots.forEach(slot => {
      const date = new Date(slot.startTime);
      const jsDay = date.getDay(); // 0=Sunday
      const ourDay = jsDay === 0 ? 6 : jsDay - 1; // Convert to our system
      
      days[ourDay] = days[ourDay] || [];
      days[ourDay].push(slot);
    });
    
    // Log by day
    console.log('Slots organized by day:');
    Object.keys(days).forEach(day => {
      console.log(`Day ${day}: ${days[day].length} slots`);
    });
  } catch(err) {
    console.error('Error checking June 1st booking:', err);
  }
}

// Function to fix the calendar day conversion
function testCalendarDayConversion() {
  // June 1st, 2025 is a Sunday
  const june1st2025 = new Date('2025-06-01T00:00:00.000Z');
  const jsDay = june1st2025.getDay(); // Should be 0 for Sunday
  const ourSystemDay = jsDay === 0 ? 6 : jsDay - 1; // Should convert to 6 (Sunday in our system)
  
  console.log(`June 1st, 2025 tests:
  - JS Date: ${june1st2025.toISOString()}
  - JS Day: ${jsDay} (0=Sunday, 1=Monday, etc.)
  - Our System Day: ${ourSystemDay} (0=Monday, 1=Tuesday, ..., 6=Sunday)
  `);
  
  // Create a week starting with June 1st
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(june1st2025);
    date.setDate(june1st2025.getDate() + i);
    
    const day = date.getDay();
    const ourDay = day === 0 ? 6 : day - 1;
    
    weekDates.push({
      date: date.toISOString(),
      jsDay: day,
      ourDay: ourDay,
      dayName: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]
    });
  }
  
  console.log('Week starting June 1st, 2025:');
  weekDates.forEach(d => {
    console.log(`- ${d.date.split('T')[0]}: JS day ${d.jsDay} (${d.dayName}) = Our day ${d.ourDay}`);
  });
}

console.log('Diagnostic functions added. Run checkJune1stBooking() or testCalendarDayConversion() in console');