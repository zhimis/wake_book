// Setup development database
const { execSync } = require('child_process');

// Ensure we're in development mode
process.env.NODE_ENV = 'development';
console.log('Running in development mode - tables will be prefixed with dev_');

// Run the drizzle-kit push command for development
console.log('Pushing schema to development database...');
execSync('npx drizzle-kit push:pg', { stdio: 'inherit' });

console.log('Development database setup completed!');