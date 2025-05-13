#!/bin/bash

# Test Email Script for Wakeboarding Park Booking System
# This script sends a test email using the Mailgun API to verify the configuration is working

# Check if email address is provided
if [ -z "$1" ]; then
  echo "Usage: $0 <recipient-email>"
  echo "Example: $0 user@example.com"
  exit 1
fi

# Recipient email from command line argument
RECIPIENT_EMAIL=$1

# Load environment variables
MAILGUN_API_KEY=$MAILGUN_API_KEY
MAILGUN_DOMAIN=$MAILGUN_DOMAIN
MAILGUN_ENDPOINT=${MAILGUN_ENDPOINT:-"https://api.mailgun.net"}

# Check if API key and domain are available
if [ -z "$MAILGUN_API_KEY" ] || [ -z "$MAILGUN_DOMAIN" ]; then
  echo "Error: MAILGUN_API_KEY and MAILGUN_DOMAIN environment variables must be set."
  exit 1
fi

echo "Sending test email to: $RECIPIENT_EMAIL"
echo "Using Mailgun domain: $MAILGUN_DOMAIN"
echo "Using Mailgun endpoint: $MAILGUN_ENDPOINT"

# Prepare HTML content
HTML_CONTENT=$(cat <<EOF
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
  <div style="text-align: center; margin-bottom: 20px;">
    <h2 style="color: #3498db; margin-bottom: 5px;">Wakeboarding Park Email Test</h2>
    <p style="color: #7f8c8d; font-size: 16px; margin-top: 0;">Testing email delivery</p>
  </div>
  
  <p>This is a test email from the Wakeboarding Park booking system.</p>
  
  <p>If you received this email, it means the email delivery system is properly configured.</p>
  
  <div style="background-color: #f1f8fe; padding: 15px; border-radius: 5px; margin: 20px 0;">
    <h4 style="color: #3498db; margin-top: 0;">Configuration Details</h4>
    <ul style="padding-left: 20px; margin-bottom: 0;">
      <li>Domain: $MAILGUN_DOMAIN</li>
      <li>Endpoint: $MAILGUN_ENDPOINT</li>
      <li>Time of test: $(date)</li>
    </ul>
  </div>
  
  <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
  
  <p>Best regards,<br>Wakeboarding Park Team</p>
  
  <div style="text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; color: #7f8c8d; font-size: 12px;">
    <p>This is an automated test message. Please do not reply to this email.</p>
  </div>
</div>
EOF
)

# Send email using curl and Mailgun API
curl -s --user "api:$MAILGUN_API_KEY" \
     "$MAILGUN_ENDPOINT/v3/$MAILGUN_DOMAIN/messages" \
     -F from="Wakeboarding Park <noreply@$MAILGUN_DOMAIN>" \
     -F to="$RECIPIENT_EMAIL" \
     -F subject="Wakeboarding Park Email Test" \
     -F html="$HTML_CONTENT" \
     -F text="This is a test email from the Wakeboarding Park booking system. If you received this email, it means the email delivery system is properly configured."

echo -e "\nTest email sent! Please check the inbox for $RECIPIENT_EMAIL."