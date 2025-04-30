// Determine the table prefix based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
export const tablePrefix = isDevelopment ? 'dev_' : 'prod_';