// This is a manual debug script to check June 1st bookings
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

// Run the check
checkJune1stBooking();
