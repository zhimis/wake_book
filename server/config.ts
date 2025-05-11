/**
 * Environment configuration
 * Contains settings that change based on environment (development vs production)
 */

// Determine the base URL based on the environment
export const getBaseUrl = (): string => {
  // For production deployment on Replit
  if (process.env.NODE_ENV === 'production') {
    return 'https://hiwake.replit.app';
  }
  
  // For development environment - use the Replit dev URL
  // You can update this as needed when the Replit URL changes
  return 'https://5e856194-fc92-4683-ae56-63781c4048c5-00-pg4k37roq8jk.worf.replit.dev';
};

// Configuration object
export const config = {
  baseUrl: getBaseUrl(),
  googleCallbackUrl: `${getBaseUrl()}/api/auth/google/callback`,
  
  // Add other environment-specific configuration as needed
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
};