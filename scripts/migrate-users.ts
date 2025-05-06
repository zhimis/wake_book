/**
 * User Schema Migration Script
 * 
 * This script:
 * 1. Creates the user_role enum type
 * 2. Adds new fields to the users table (email, role, etc.)
 * 3. Updates existing users with defaults
 * 4. Sets email as unique and required
 */

import { db, pool } from '../server/db';
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { users } from '../shared/schema';
import { sql } from 'drizzle-orm';

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function migrateUsers() {
  console.log('Starting user schema migration...');
  
  try {
    // Create user_role enum if it doesn't exist
    await pool.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
              CREATE TYPE user_role AS ENUM ('admin', 'manager', 'operator', 'athlete');
          END IF;
      END$$;
    `);
    console.log('Created user_role enum type (if it did not exist)');
    
    // Check if email column exists before adding it
    const checkEmailResult = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'email';
    `);
    
    if (checkEmailResult.rows.length === 0) {
      // Add email column
      await pool.query(`
        ALTER TABLE users 
        ADD COLUMN email TEXT NULL;
      `);
      console.log('Added email column to users table');
    } else {
      console.log('Email column already exists');
    }
    
    // Check and add the rest of the columns if needed
    const columns = [
      { name: 'role', type: 'user_role', default: "'athlete'" },
      { name: 'first_name', type: 'TEXT', default: 'NULL' },
      { name: 'last_name', type: 'TEXT', default: 'NULL' },
      { name: 'phone_number', type: 'TEXT', default: 'NULL' },
      { name: 'is_active', type: 'BOOLEAN', default: 'TRUE' },
      { name: 'last_login', type: 'TIMESTAMP', default: 'NULL' },
      { name: 'created_at', type: 'TIMESTAMP', default: 'NOW()' }
    ];
    
    for (const column of columns) {
      const checkResult = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'users' AND column_name = '${column.name}';
      `);
      
      if (checkResult.rows.length === 0) {
        await pool.query(`
          ALTER TABLE users 
          ADD COLUMN ${column.name} ${column.type} ${column.default !== 'NULL' ? 'NOT NULL DEFAULT ' + column.default : 'NULL'};
        `);
        console.log(`Added ${column.name} column to users table`);
      } else {
        console.log(`Column ${column.name} already exists`);
      }
    }
    
    // Get all existing users that don't have an email
    const existingUsersQuery = await db.select().from(users).execute();
    const existingUsers = existingUsersQuery || [];
    
    // Update existing users with default values
    for (const user of existingUsers) {
      if (!user.email) {
        // Hash the existing password if it's plaintext
        let password = user.password;
        if (!password.includes('.')) {
          console.log(`Hashing password for user: ${user.username}`);
          password = await hashPassword(password);
        }
        
        // Generate a default email based on username
        const email = `${user.username}@hiwake.lv`;
        
        // Update the user
        await db.update(users)
          .set({ 
            email,
            role: 'admin', // Existing users get admin role by default
            password,
            isActive: true,
            firstName: user.username,
            lastName: 'User',
            createdAt: new Date()
          })
          .where(sql`id = ${user.id}`);
        
        console.log(`Updated user: ${user.username} with default email: ${email} and admin role`);
      }
    }
    
    // Make email required and unique (after we've filled in values for existing users)
    await pool.query(`
      ALTER TABLE users 
      ALTER COLUMN email SET NOT NULL,
      ADD CONSTRAINT users_email_unique UNIQUE (email);
    `);
    console.log('Made email NOT NULL and UNIQUE');
    
    console.log('User schema migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Execute the migration
migrateUsers().catch(console.error);