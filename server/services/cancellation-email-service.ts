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

// Check if the endpoint has a proper protocol prefix
const formattedEndpoint = MAILGUN_ENDPOINT 
  ? (MAILGUN_ENDPOINT.startsWith('http://') || MAILGUN_ENDPOINT.startsWith('https://') 
      ? MAILGUN_ENDPOINT 
      : `https://${MAILGUN_ENDPOINT}`)
  : undefined;

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
 * Send a cancellation confirmation email to the customer
 */
export const sendCustomerCancellationEmail = async (
  booking: BookingDetails,
  recipientEmail: string
): Promise<boolean> => {
  if (!recipientEmail) {
    console.log('No email provided for customer cancellation email');
    return false;
  }

  try {
    // Get the first timeslot date to display
    const bookingDate = booking.timeSlots.length > 0 
      ? formatDate(new Date(booking.timeSlots[0].startTime))
      : 'Unknown date';
    
    // Sort time slots and get times for display
    const sortedSlots = [...booking.timeSlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const startTime = formatTime(new Date(firstSlot.startTime));
    const endTime = formatTime(new Date(lastSlot.endTime));
    
    // Generate time slot table HTML
    const timeSlotTable = generateTimeSlotHtml(booking);

    const emailData = {
      from: `HiWake 2.0 <noreply@${MAILGUN_DOMAIN}>`,
      to: recipientEmail,
      subject: `Booking Cancellation - ${booking.booking.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #e74c3c; margin-bottom: 5px;">Your Booking Has Been Cancelled</h2>
            <p style="color: #7f8c8d; font-size: 16px; margin-top: 0;">Confirmation of cancellation</p>
          </div>
          
          <p>Dear ${booking.booking.customerName},</p>
          
          <p>We're confirming that your wakeboarding session at HiWake 2.0 has been <strong>cancelled</strong> as requested.</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${booking.booking.reference}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
          </div>
          
          <h3 style="color: #e74c3c; border-bottom: 1px solid #eee; padding-bottom: 8px;">Cancelled Booking Details</h3>
          
          ${timeSlotTable}
          
          <div style="background-color: #f1f1f1; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h4 style="color: #555; margin-top: 0;">Need to Book Again?</h4>
            <p>If you would like to make a new booking for a different time, please visit our website.</p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>If you have any questions, please contact us with your booking reference.</p>
          
          <p>Best regards,<br>HiWake 2.0 Team</p>
          
          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    console.log(`Attempting to send cancellation email to customer: ${recipientEmail}`);
    
    // Send the email
    const response = await mg.messages.create(MAILGUN_DOMAIN, emailData);
    console.log('Customer cancellation email sent:', response);
    return true;
  } catch (error) {
    console.error('Error sending customer cancellation email:', error);
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
 * Send a notification email to admin(s) about a booking cancellation
 */
export const sendAdminCancellationNotification = async (
  booking: BookingDetails
): Promise<boolean> => {
  try {
    // Get admin email from configuration
    const adminEmail = await getAdminEmail();
    
    // Get the first timeslot date to display
    const bookingDate = booking.timeSlots.length > 0 
      ? formatDate(new Date(booking.timeSlots[0].startTime))
      : 'Unknown date';
    
    // Sort time slots and get times for display
    const sortedSlots = [...booking.timeSlots].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    const firstSlot = sortedSlots[0];
    const lastSlot = sortedSlots[sortedSlots.length - 1];
    const startTime = formatTime(new Date(firstSlot.startTime));
    const endTime = formatTime(new Date(lastSlot.endTime));
    
    // Generate time slot table HTML
    const timeSlotTable = generateTimeSlotHtml(booking);
    
    // Get current time for the notification timestamp
    const cancellationTime = formatInTimeZone(new Date(), 'Europe/Riga', 'dd.MM.yyyy HH:mm:ss');

    const emailData = {
      from: `HiWake 2.0 <noreply@${MAILGUN_DOMAIN}>`,
      to: adminEmail,
      subject: `🚫 Booking Cancellation Alert - ${booking.booking.reference}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <div style="text-align: center; background-color: #e74c3c; color: white; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
            <h2 style="margin: 0;">Booking Cancellation Alert!</h2>
          </div>
          
          <p>Hello Admin,</p>
          
          <p>A booking at HiWake 2.0 has been <strong>cancelled</strong>. Here are the details:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #e74c3c;">
            <p style="margin: 5px 0;"><strong>Booking Reference:</strong> ${booking.booking.reference}</p>
            <p style="margin: 5px 0;"><strong>Customer:</strong> ${booking.booking.customerName}</p>
            <p style="margin: 5px 0;"><strong>Phone:</strong> ${booking.booking.phoneNumber}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${booking.booking.email || 'Not provided'}</p>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${startTime} - ${endTime}</p>
            <p style="margin: 5px 0;"><strong>Cancellation Time:</strong> ${cancellationTime}</p>
          </div>
          
          <h3 style="color: #e74c3c; border-bottom: 1px solid #eee; padding-bottom: 8px;">Cancelled Time Slots</h3>
          
          ${timeSlotTable}
          
          <div style="background-color: #f9f2f4; border-left: 4px solid #c7254e; padding: 15px; margin: 20px 0; border-radius: 4px;">
            <h4 style="color: #c7254e; margin-top: 0;">Attention</h4>
            <ul style="padding-left: 20px; margin-bottom: 0;">
              <li>These time slots are now available for new bookings</li>
              <li>You may want to update your staffing schedule</li>
              <li>If equipment was reserved, it is now available</li>
            </ul>
          </div>

          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          
          <p>No further action is required.</p>
          
          <p>HiWake 2.0 Booking System</p>
          
          <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 12px;">
            <p>This is an automated message from the booking system.</p>
          </div>
        </div>
      `
    };

    console.log(`Attempting to send cancellation notification to admin: ${adminEmail}`);
    
    // Send the email
    const response = await mg.messages.create(MAILGUN_DOMAIN, emailData);
    console.log('Admin cancellation notification email sent:', response);
    return true;
  } catch (error) {
    console.error('Error sending admin cancellation notification email:', error);
    // Print more detailed error information
    if (error instanceof Error) {
      console.error(`Error name: ${error.name}`);
      console.error(`Error message: ${error.message}`);
      console.error(`Error stack: ${error.stack}`);
    }
    return false;
  }
};