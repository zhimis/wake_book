/**
 * Email Service Test Script
 * 
 * This script tests the email service by sending a test email
 * to verify the Mailgun configuration is working correctly.
 */

import formData from 'form-data';
import Mailgun from 'mailgun.js';

// Initialize Mailgun client
const mailgun = new Mailgun(formData);
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || '';
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || '';
const MAILGUN_ENDPOINT = process.env.MAILGUN_ENDPOINT || '';

console.log(`Email Service Test - Using Mailgun domain: ${MAILGUN_DOMAIN}`);
console.log(`Email Service Test - API key present: ${MAILGUN_API_KEY ? 'Yes' : 'No'}`);
console.log(`Email Service Test - Using endpoint: ${MAILGUN_ENDPOINT || 'Default US endpoint'}`);

// Configure mg client with the EU endpoint if provided
const mg = mailgun.client({
  username: 'api',
  key: MAILGUN_API_KEY,
  url: MAILGUN_ENDPOINT || undefined
});

async function sendTestEmail() {
  try {
    console.log(`Using Mailgun domain: ${MAILGUN_DOMAIN}`);
    
    const testEmailData = {
      from: `Wakeboarding Park <booking@${MAILGUN_DOMAIN}>`,
      to: process.argv[2] || 'test@example.com', // Use command line argument or default
      subject: 'Test Email from Wakeboarding Park',
      text: 'This is a test email to verify the Mailgun configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
          <h2 style="color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;">Wakeboarding Park Test Email</h2>
          <p>This is a test email to verify that the Mailgun configuration is working correctly.</p>
          <p>If you received this email, it means the email delivery system is properly configured.</p>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-top: 20px;">
            <p style="margin: 0; color: #6c757d; font-size: 14px;">This is an automated message. Please do not reply to this email.</p>
          </div>
        </div>
      `
    };

    console.log('Sending test email...');
    const result = await mg.messages.create(MAILGUN_DOMAIN, testEmailData);
    console.log('Test email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Error sending test email:', error);
    if (error.details) {
      console.error('Error details:', error.details);
    }
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Execute the test function
sendTestEmail()
  .then(() => console.log('Email test completed.'))
  .catch(err => console.error('Email test failed:', err));