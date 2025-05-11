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
  
  // Google OAuth has restrictions on complex subdomains for redirect URIs
  // For development environment, we could use localhost for Google OAuth testing
  // Currently using the Replit dev URL (which might have restrictions with Google OAuth)
  return 'https://5e856194-fc92-4683-ae56-63781c4048c5-00-pg4k37roq8jk.worf.replit.dev';
};

// Configuration object
export const config = {
  baseUrl: getBaseUrl(),
  // Using the original callback URL that's configured in Google Cloud Console
  googleCallbackUrl: "/api/auth/google/callback",
  
  // Add other environment-specific configuration as needed
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production'
};