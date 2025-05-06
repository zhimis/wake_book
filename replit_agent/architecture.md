# Architecture Overview - Hi Wake 2.0 Wakeboarding Park Booking System

## Overview

Hi Wake 2.0 is a modern, responsive web application designed for managing bookings at a wakeboarding park. The system allows customers to view time slot availability, make bookings, and for administrators to manage those bookings, configure system settings, and view statistics. The application implements a timezone-aware design specifically for a wakeboarding park operating in Latvia (Europe/Riga timezone).

## System Architecture

The application follows a client-server architecture with the following characteristics:

- **Frontend**: React-based single-page application (SPA)
- **Backend**: Node.js with Express server
- **Database**: PostgreSQL for persistent data storage
- **State Management**: React Query for server state, React Context for client state
- **Styling**: Tailwind CSS with Shadcn UI components

The system is designed to be deployed on Replit, with configurations for both development and production environments.

## Key Components

### Frontend Components

1. **Public-facing Components**
   - `HomePage`: Entry point with booking calendar
   - `BookingPage`: Form for completing bookings
   - `ConfirmationPage`: Booking confirmation details
   - `PublicPage`: Public view of available time slots

2. **Admin Components**
   - `AdminDashboard`: Overview with statistics and quick actions
   - `AdminCalendarView`: Calendar for viewing and managing bookings
   - `AdminSystemConfig`: System configuration interface
   - `LoginForm`: Authentication for admin users

3. **Shared Components**
   - `BookingCalendar`: Calendar view of time slots
   - Various UI components from Shadcn UI

### Backend Components

1. **API Routes**
   - Time slot endpoints: `/api/timeslots`
   - Booking endpoints: `/api/bookings`
   - Admin endpoints: `/api/admin`
   - Configuration endpoints: `/api/config`
   - Authentication endpoints: `/api/login`, `/api/logout`

2. **Core Services**
   - `auth.ts`: Authentication and session management
   - `storage.ts`: Data access layer for database interactions
   - `timezone.ts`: Timezone utility functions for Latvia-specific time handling

3. **Database Schema**
   - `users`: Admin user accounts
   - `timeSlots`: Available time slots for booking
   - `bookings`: Customer booking information
   - `bookingTimeSlots`: Many-to-many relationship between bookings and time slots
   - `operatingHours`: Operating hours configuration by day of week
   - `pricing`: Price configuration for different time slots
   - `configuration`: System-wide configuration settings

## Data Flow

### Booking Flow

1. User browses available time slots on the booking calendar
2. User selects one or more consecutive time slots
3. Selected slots are temporarily reserved (10-minute countdown)
4. User fills out booking information form
5. On submission, the backend creates a booking and links it with the selected time slots
6. User is redirected to a confirmation page with booking details

### Admin Flow

1. Admin logs in via the login page
2. Admin can view the dashboard with statistics and recent bookings
3. Admin can manage bookings through the calendar view
4. Admin can configure system settings, operating hours, and pricing

## External Dependencies

### Frontend Libraries

- **React**: Core UI library
- **TanStack React Query**: Data fetching and cache management
- **Wouter**: Lightweight routing
- **Shadcn UI**: Component library built on Radix UI
- **Tailwind CSS**: Utility-first CSS framework
- **date-fns** and **date-fns-tz**: Date manipulation with timezone support

### Backend Libraries

- **Express**: Web server framework
- **Drizzle ORM**: Database ORM for PostgreSQL
- **Neon Database Client**: Serverless PostgreSQL client
- **Passport**: Authentication middleware
- **Connect-PG-Simple**: PostgreSQL session store

## Deployment Strategy

The application is configured for deployment on Replit with the following characteristics:

1. **Development Environment**
   - NODE_ENV=development
   - Uses dev-prefixed database tables
   - Hot module reloading for frontend development

2. **Production Environment**
   - NODE_ENV=production
   - Uses prod-prefixed database tables
   - Built frontend served from static files

3. **Database Configuration**
   - Supports different database connections for development and production
   - Falls back to a common DATABASE_URL if specific environment URLs aren't provided
   - Option to use the same database with environment-specific table prefixes

4. **Build Process**
   - Frontend: Vite for bundling
   - Backend: esbuild for TypeScript compilation

## Key Architectural Decisions

### 1. Timezone Handling Strategy

**Problem**: The application serves users in various timezones, but operates in Latvia (Europe/Riga) timezone.

**Solution**: Implemented a comprehensive timezone handling strategy:
- All dates are stored in UTC in the database with an explicit `storageTimezone` field
- Server-side utilities convert between UTC and Latvia time
- Client displays all times in Latvia timezone with indicators for international users
- Custom validation ensures consistent timezone handling across the application

**Benefits**:
- Consistent time representation across the system
- Clear timezone indicators for users outside Latvia
- Properly handles daylight saving time transitions

### 2. Table Prefix for Development/Production Separation

**Problem**: Need to separate development and production data while potentially using the same database.

**Solution**: Implemented a table prefix system based on the NODE_ENV environment variable:
- Development mode uses "dev_" prefixed tables
- Production mode uses "prod_" prefixed tables

**Benefits**:
- Allows testing with production-like data
- Simplifies database management when resources are limited
- Reduces cost by potentially sharing a single database instance

### 3. Memory Session Store vs PostgreSQL Session Store

**Problem**: Need to determine how to store user sessions.

**Solution**: Implemented a flexible session storage approach:
- PostgreSQL-backed session store for production use
- Optional in-memory session store for development

**Benefits**:
- Persistent sessions across server restarts in production
- Simpler setup for development
- Scalable for production use

### 4. Responsive Mobile-First Design

**Problem**: Need to support both mobile and desktop users with an emphasis on mobile experience.

**Solution**: Implemented a mobile-first responsive design using Tailwind CSS:
- Layout components adapt to different screen sizes
- Touch-friendly interface for mobile users
- Optimized calendar view for small screens

**Benefits**:
- Consistent user experience across devices
- Optimized for the primary use case (mobile booking)
- Progressive enhancement for desktop users