/**
 * Create Feedback Table Script
 * 
 * This script creates the feedback table in the database.
 * Run this script manually when you want to add the feedback functionality.
 */

import pg from 'pg';
const { Pool } = pg;

async function createFeedbackTable() {
  // Create a PostgreSQL client
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Connect to the database
    const client = await pool.connect();
    console.log('Connected to database');

    // Create the feedback table if it doesn't exist
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS feedback (
        id SERIAL PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        rating INTEGER NOT NULL,
        comment TEXT NOT NULL,
        email TEXT,
        category TEXT DEFAULT 'general',
        status TEXT DEFAULT 'new' NOT NULL,
        admin_notes TEXT,
        user_id INTEGER,
        user_ip TEXT,
        user_agent TEXT
      );
    `;

    await client.query(createTableQuery);
    console.log('Feedback table created successfully');

    // Check if the table was created or already existed
    const checkTableQuery = `
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'feedback'
      );
    `;
    
    const checkResult = await client.query(checkTableQuery);
    
    if (checkResult.rows[0].exists) {
      console.log('Confirmed: Feedback table exists in the database');
    } else {
      console.error('Error: Failed to confirm feedback table existence');
    }

    // Release the client
    client.release();

  } catch (error) {
    console.error('Error creating feedback table:', error);
  } finally {
    // Close the pool
    await pool.end();
    console.log('Database connection closed');
  }
}

// Run the function
createFeedbackTable().catch(console.error);