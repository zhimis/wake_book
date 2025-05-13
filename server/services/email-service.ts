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

const mg = mailgun.client({
  username: 'api',
  key: MAILGUN_API_KEY,
  url: MAILGUN_ENDPOINT || undefined // Use the EU endpoint if provided
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
    `Your wakeboarding session booking. Reference: ${booking.booking.reference}`
  );
  const location = encodeURIComponent('Wakeboarding Park');
  
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
      
    // Create iCal link
    const calendarLink = createCalendarLink(booking);
    
    // Generate time slot table HTML
    const timeSlotTable = generateTimeSlotHtml(booking);

    const emailData = {
      from: `Wakeboarding Park <noreply@${MAILGUN_DOMAIN}>`,
      to: recipientEmail,
      subject: `Booking Confirmation - ${booking.booking.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">Your Wakeboarding Session is Confirmed!</h2>
          
          <p>Dear ${booking.booking.customerName},</p>
          
          <p>Thank you for booking with us. Your wakeboarding session is confirmed for <strong>${bookingDate}</strong>.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Booking Reference:</strong> ${booking.booking.reference}</p>
          </div>
          
          <h3 style="color: #3498db;">Booking Details</h3>
          
          ${timeSlotTable}
          
          <p>
            <a href="${calendarLink}" download="wakeboarding_session.ics" 
               style="display: inline-block; background-color: #3498db; color: white; 
                      padding: 10px 15px; text-decoration: none; border-radius: 4px;">
              Add to Calendar
            </a>
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>If you have any questions or need to make changes to your booking, please contact us with your booking reference.</p>
          
          <p>We look forward to seeing you!</p>
          
          <p>Best regards,<br>Wakeboarding Park Team</p>
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
    
    // Generate time slot table HTML
    const timeSlotTable = generateTimeSlotHtml(booking);
    
    // Create iCal link
    const calendarLink = createCalendarLink(booking);

    const emailData = {
      from: `Wakeboarding Park <noreply@${MAILGUN_DOMAIN}>`,
      to: adminEmail,
      subject: `New Booking Alert - ${booking.booking.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #3498db;">New Booking Received!</h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${booking.booking.reference}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${booking.booking.customerName}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${booking.booking.phoneNumber}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${booking.booking.email || 'Not provided'}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
          </div>
          
          <h3 style="color: #3498db;">Booking Details</h3>
          
          ${timeSlotTable}
          
          <p>
            <a href="${calendarLink}" download="wakeboarding_session.ics" 
               style="display: inline-block; background-color: #3498db; color: white; 
                      padding: 10px 15px; text-decoration: none; border-radius: 4px;">
              Add to Calendar
            </a>
          </p>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>Please review this booking and prepare for the customer's arrival.</p>
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