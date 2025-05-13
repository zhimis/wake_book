import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { BookingDetails } from '../../shared/schema';
import { formatInTimeZone } from 'date-fns-tz';
import { storage } from '../storage';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const MAILGUN_ENDPOINT = process.env.MAILGUN_ENDPOINT || '';

console.log(`Email Service Initialization - Using Mailgun domain: ${MAILGUN_DOMAIN}`);
console.log(`Email Service Initialization - API key present: ${MAILGUN_API_KEY ? 'Yes' : 'No'}`);
console.log(`Email Service Initialization - Using endpoint: ${MAILGUN_ENDPOINT || 'Default US endpoint'}`);

// Check if the endpoint has a proper protocol prefix
const formattedEndpoint = MAILGUN_ENDPOINT 
  ? (MAILGUN_ENDPOINT.startsWith('http://') || MAILGUN_ENDPOINT.startsWith('https://') 
      ? MAILGUN_ENDPOINT 
      : `https://${MAILGUN_ENDPOINT}`)
  : undefined;

console.log(`Email Service Initialization - Formatted endpoint: ${formattedEndpoint || 'Using default'}`);

const mg = mailgun.client({
  username: 'api',
  key: MAILGUN_API_KEY,
  url: formattedEndpoint
});

// Get admin email from configuration or use fallback
const getAdminEmail = async (): Promise<string> => {
  try {
    const config = await storage.getConfiguration('adminEmail');
    return config?.value || 'admin@example.com';
  } catch (error) {
    console.error('Failed to get admin email from configuration:', error);
    return 'admin@example.com';
  }
};

// Format date for emails in Latvia timezone
const formatDate = (date: Date): string => {
  return formatInTimeZone(date, 'Europe/Riga', 'dd.MM.yyyy');
};

// Format time for emails in Latvia timezone
const formatTime = (date: Date): string => {
  return formatInTimeZone(date, 'Europe/Riga', 'HH:mm');
};

// Helper to create a calendar link (iCal format)
const createCalendarLink = (booking: BookingDetails): string => {
  // Get the first and last time slots
  const sortedSlots = [...booking.timeSlots].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];
  
  // Format dates for iCal
  const start = new Date(firstSlot.startTime).toISOString().replace(/-|:|\.\d+/g, '');
  const end = new Date(lastSlot.endTime).toISOString().replace(/-|:|\.\d+/g, '');
  const summary = encodeURIComponent(`Wakeboarding Session - ${booking.booking.reference}`);
  const description = encodeURIComponent(
    `Your HiWake 2.0 wakeboarding session booking.\nReference: ${booking.booking.reference}\nName: ${booking.booking.customerName}\nPhone: ${booking.booking.phoneNumber}\nEquipment Rental: ${booking.booking.equipmentRental ? 'Yes' : 'No'}`
  );
  const location = encodeURIComponent('Pulksteņezers, 2163 Ādaži Siguļi, Carnikava, LV-2163');
  
  // Create iCalendar file content
  const ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    `LOCATION:${location}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\n');
  
  // Create a data URI for the calendar file
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ical)}`;
};

// Generate HTML for slot time display
const generateTimeSlotHtml = (booking: BookingDetails): string => {
  // Sort time slots by start time
  const sortedSlots = [...booking.timeSlots].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );
  
  // Create HTML rows for each time slot
  const slotRows = sortedSlots.map(slot => {
    const startTime = formatTime(new Date(slot.startTime));
    const endTime = formatTime(new Date(slot.endTime));
    return `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${startTime} - ${endTime}</td>
        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${slot.price} €</td>
      </tr>
    `;
  }).join('');
  
  return `
    <table style="width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 15px;">
      <thead>
        <tr>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">Time Slot</th>
          <th style="padding: 8px; border: 1px solid #ddd; text-align: right;">Price</th>
        </tr>
      </thead>
      <tbody>
        ${slotRows}
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Total</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; text-align: right;">${booking.totalPrice} €</td>
        </tr>
      </tbody>
    </table>
  `;
};

/**
 * Send a booking confirmation email to the customer
 */
export const sendCustomerBookingConfirmation = async (
  booking: BookingDetails,
  recipientEmail: string
): Promise<boolean> => {
  if (!recipientEmail) {
    console.log('No email provided for customer booking confirmation');
    return false;
  }

  try {
    // Get the first timeslot date to display
    const bookingDate = booking.timeSlots.length > 0 
      ? formatDate(new Date(booking.timeSlots[0].startTime))
      : 'Unknown date';
    
    // Sort time slots and get start/end times for calendar
    const sortedSlots = [...booking.timeSlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    // Format dates for calendar URL
    const start = new Date(firstSlot.startTime).toISOString().replace(/-|:|\.\d+/g, '');
    const end = new Date(lastSlot.endTime).toISOString().replace(/-|:|\.\d+/g, '');
      
    // Create iCal link
    const calendarLink = createCalendarLink(booking);
    
    // Generate time slot table HTML
    const timeSlotTable = generateTimeSlotHtml(booking);

    const emailData = {
      from: `HiWake 2.0 <noreply@${MAILGUN_DOMAIN}>`,
      to: recipientEmail,
      subject: `Booking Confirmation - ${booking.booking.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #3498db; margin-bottom: 5px;">Your Wakeboarding Session is Confirmed!</h2>
            <p style="color: #7f8c8d; font-size: 16px; margin-top: 0;">Thank you for your booking</p>
          </div>
          
          <p>Dear ${booking.booking.customerName},</p>
          
          <p>We're excited to confirm your wakeboarding session at HiWake 2.0. Your session is scheduled for <strong>${bookingDate}</strong>.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3498db;">
            <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${booking.booking.reference}</p>
            <p style="margin: 5px 0;"><strong>Equipment Rental:</strong> ${booking.booking.equipmentRental ? 'Yes' : 'No'}</p>
            <p style="margin: 5px 0;"><strong>Location:</strong> Pulksteņezers, 2163 Ādaži Siguļi, Carnikava, LV-2163</p>
            <p style="margin: 5px 0;"><strong>Get Directions:</strong> <a href="https://www.waze.com/ul?ll=57.1300204%2C24.3301119&navigate=yes" style="color: #3498db; text-decoration: underline;">Navigate with Waze</a></p>
          </div>
          
          <h3 style="color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 8px;">Your Booking Details</h3>
          
          ${timeSlotTable}
          
          <div style="margin: 25px 0; text-align: center;">
            <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Wakeboarding Session - HiWake 2.0`)}&dates=${start}/${end}&details=${encodeURIComponent(`Booking Reference: ${booking.booking.reference}\nName: ${booking.booking.customerName}\nPhone: ${booking.booking.phoneNumber}\nEquipment Rental: ${booking.booking.equipmentRental ? 'Yes' : 'No'}`)}&location=${encodeURIComponent('Pulksteņezers, 2163 Ādaži Siguļi, Carnikava, LV-2163')}" 
               target="_blank" 
               style="display: inline-block; background-color: #3498db; color: white; 
                      padding: 12px 20px; text-decoration: none; border-radius: 4px;
                      font-weight: bold;">
              📅 Add to Google Calendar
            </a>
          </div>
          
          <div style="background-color: #f1f8fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #3498db; margin-top: 0;">Important Information</h4>
            <ul style="padding-left: 20px; margin-bottom: 0;">
              <li>Please arrive 15 minutes before your session to complete check-in.</li>
              <li>Wear appropriate swimwear and bring a towel.</li>
              <li>In case of bad weather, we may need to reschedule your session.</li>
            </ul>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>If you have any questions or need to make changes to your booking, please contact us with your booking reference.</p>
          
          <p>We look forward to seeing you at HiWake 2.0!</p>
          
          <p>Best regards,<br>HiWake 2.0 Team</p>
          
          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    console.log(`Attempting to send customer email to: ${recipientEmail}`);
    console.log(`Using Mailgun domain: ${MAILGUN_DOMAIN}`);
    
    // Send the email
    const response = await mg.messages.create(MAILGUN_DOMAIN, emailData);
    console.log('Customer confirmation email sent:', response);
    return true;
  } catch (error) {
    console.error('Error sending customer confirmation email:', error);
    // Print more detailed error information
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    return false;
  }
};

/**
 * Send a notification email to admin(s) about a new booking
 */
export const sendAdminBookingNotification = async (
  booking: BookingDetails
): Promise<boolean> => {
  try {
    // Get admin email from configuration
    const adminEmail = await getAdminEmail();
    
    // Get the first timeslot date to display
    const bookingDate = booking.timeSlots.length > 0 
      ? formatDate(new Date(booking.timeSlots[0].startTime))
      : 'Unknown date';
    
    // Sort time slots and get start/end times for calendar
    const sortedSlots = [...booking.timeSlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    
    // Format dates for calendar URL
    const start = new Date(firstSlot.startTime).toISOString().replace(/-|:|\.\d+/g, '');
    const end = new Date(lastSlot.endTime).toISOString().replace(/-|:|\.\d+/g, '');
    
    // Generate time slot table HTML
    const timeSlotTable = generateTimeSlotHtml(booking);
    
    // Create iCal link
    const calendarLink = createCalendarLink(booking);

    const emailData = {
      from: `HiWake 2.0 <noreply@${MAILGUN_DOMAIN}>`,
      to: adminEmail,
      subject: `🔔 New Booking Alert - ${booking.booking.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; background-color: #3498db; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="margin: 0;">New Booking Received!</h2>
          </div>
          
          <p>Hello Admin,</p>
          
          <p>A new booking has been made at HiWake 2.0. Here are the details:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${booking.booking.reference}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${booking.booking.customerName}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${booking.booking.phoneNumber}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${booking.booking.email || 'Not provided'}</p>
            <p style="margin: 5px 0;"><strong>Experience Level:</strong> ${booking.booking.experienceLevel || 'Not specified'}</p>
            <p style="margin: 5px 0;"><strong>Equipment Rental:</strong> ${booking.booking.equipmentRental ? 'Yes' : 'No'}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0;"><strong>Notes:</strong> ${booking.booking.notes || 'No notes provided'}</p>
          </div>
          
          <h3 style="color: #3498db; border-bottom: 1px solid #eee; padding-bottom: 8px;">Time Slots Booked</h3>
          
          ${timeSlotTable}
          
          <div style="margin: 25px 0; text-align: center;">
            <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`Wakeboarding Session - HiWake 2.0`)}&dates=${start}/${end}&details=${encodeURIComponent(`Booking Reference: ${booking.booking.reference}\nCustomer: ${booking.booking.customerName}\nPhone: ${booking.booking.phoneNumber}\nEmail: ${booking.booking.email || 'Not provided'}\nEquipment Rental: ${booking.booking.equipmentRental ? 'Yes' : 'No'}`)}&location=${encodeURIComponent('Pulksteņezers, 2163 Ādaži Siguļi, Carnikava, LV-2163')}" 
               target="_blank"
               style="display: inline-block; background-color: #3498db; color: white; 
                      padding: 12px 20px; text-decoration: none; border-radius: 4px;
                      font-weight: bold;">
              📅 Add to Google Calendar
            </a>
          </div>

          <div style="background-color: #f9f2f4; border-left: 4px solid #c7254e; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h4 style="color: #c7254e; margin-top: 0;">Action Required</h4>
            <ul style="padding-left: 20px; margin-bottom: 0;">
              <li>Verify equipment availability for this session</li>
              <li>Check if an instructor needs to be assigned</li>
              <li>Confirm if there are any special requirements</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>Please review this booking and prepare for the customer's arrival.</p>
          
          <p>HiWake 2.0 Booking System</p>
          
          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated message from the booking system.</p>
          </div>
        </div>
      `
    };

    console.log(`Attempting to send admin email to: ${adminEmail}`);
    console.log(`Using Mailgun domain: ${MAILGUN_DOMAIN}`);
    
    // Send the email
    const response = await mg.messages.create(MAILGUN_DOMAIN, emailData);
    console.log('Admin notification email sent:', response);
    return true;
  } catch (error) {
    console.error('Error sending admin notification email:', error);
    // Print more detailed error information
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    return false;
  }
};