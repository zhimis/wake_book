// Setup production database
const { execSync } = require('child_process');

// Set production mode
process.env.NODE_ENV = 'production';
console.log('Running in production mode - tables will be prefixed with prod_');

// Run the drizzle-kit push command for production
console.log('Pushing schema to production database...');
execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });

console.log('Production database setup completed!');