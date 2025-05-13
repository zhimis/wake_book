# Multi-tenant Infrastructure Technical Specification

## Overview

This document outlines the technical approach to implementing multi-tenant infrastructure in the WakeBook application. This feature will allow the platform to support multiple wakeboarding parks or venues, each with their own administrators, bookings, and configurations.

## Technical Requirements

### Core Functionality

- Support for multiple independent wakeboarding parks/venues
- Role-based access control across venues
- Venue-specific configuration and settings
- Independent booking systems per venue
- Cross-venue reporting for platform administrators

### User Roles

- **Platform Admin**: Can manage all venues and global settings
- **Venue Owner**: Can manage a specific venue and its settings
- **Venue Manager**: Can manage bookings and operations for a venue
- **Venue Staff**: Can view and manage day-to-day bookings at a venue
- **Customer**: Can book sessions at any venue

## Data Model Changes

### Venues Table

```typescript
export const venues = pgTable('venues', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').unique().notNull(),
  address: text('address'),
  city: text('city'),
  country: text('country'),
  timezone: text('timezone').default('Europe/Riga').notNull(),
  logoUrl: text('logo_url'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  websiteUrl: text('website_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type Venue = typeof venues.$inferSelect;
export type InsertVenue = typeof venues.$inferInsert;
```

### User Roles and Permissions

```typescript
export const userRoles = pgEnum('user_role', [
  'platform_admin',
  'venue_owner',
  'venue_manager',
  'venue_staff',
  'customer'
]);

export const userVenueRoles = pgTable('user_venue_roles', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  venueId: integer('venue_id').references(() => venues.id, { onDelete: 'cascade' }).notNull(),
  role: userRoles('role').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Create a unique constraint to prevent duplicate role assignments
export const userVenueRolesIndex = uniqueIndex('user_venue_roles_idx').on(userVenueRoles.userId, userVenueRoles.venueId, userVenueRoles.role);
```

### Update to Existing Tables

```typescript
// Update the users table to include primary venue
export const users = pgTable('users', {
  // ... existing fields
  primaryVenueId: integer('primary_venue_id').references(() => venues.id),
});

// Update bookings to include venue
export const bookings = pgTable('bookings', {
  // ... existing fields
  venueId: integer('venue_id').references(() => venues.id).notNull(),
});

// Update time slots to include venue
export const timeSlots = pgTable('time_slots', {
  // ... existing fields
  venueId: integer('venue_id').references(() => venues.id).notNull(),
});

// Update operating hours to include venue
export const operatingHours = pgTable('operating_hours', {
  // ... existing fields
  venueId: integer('venue_id').references(() => venues.id).notNull(),
});
```

### Venue Configuration

```typescript
export const venueSettings = pgTable('venue_settings', {
  id: serial('id').primaryKey(),
  venueId: integer('venue_id').references(() => venues.id, { onDelete: 'cascade' }).notNull(),
  defaultSlotDuration: integer('default_slot_duration').default(30).notNull(), // in minutes
  defaultPrice: integer('default_price').default(15).notNull(), // in euros
  currencyCode: text('currency_code').default('EUR').notNull(),
  bookingLeadTime: integer('booking_lead_time').default(120).notNull(), // in minutes
  maxBookingWindow: integer('max_booking_window').default(28).notNull(), // in days
  enableWeatherForecast: boolean('enable_weather_forecast').default(true).notNull(),
  allowMultiSlotBooking: boolean('allow_multi_slot_booking').default(true).notNull(),
  requirePhoneNumber: boolean('require_phone_number').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});
```

### Venue Features and Facilities

```typescript
export const venueFeatures = pgTable('venue_features', {
  id: serial('id').primaryKey(),
  venueId: integer('venue_id').references(() => venues.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  iconName: text('icon_name'), // For displaying feature icons
  isActive: boolean('is_active').default(true).notNull()
});
```

## Implementation Details

### 1. Authentication and Authorization

Update the authentication system to include venue-specific authorization:

```typescript
// Middleware to check venue-specific permissions
async function checkVenuePermission(req, res, next) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const venueId = parseInt(req.params.venueId || req.body.venueId);
  if (!venueId) {
    return res.status(400).json({ error: "Venue ID is required" });
  }

  // Check if user has access to this venue
  const userRole = await getUserRoleForVenue(req.user.id, venueId);
  
  if (!userRole) {
    return res.status(403).json({ error: "You don't have access to this venue" });
  }
  
  // Add the role to the request for further permission checks
  req.userVenueRole = userRole;
  next();
}
```

### 2. Venue Context Provider

```typescript
import React, { createContext, useState, useContext, useEffect } from 'react';

interface VenueContextType {
  currentVenueId: number | null;
  setCurrentVenueId: (venueId: number) => void;
  userVenues: Venue[];
  isLoading: boolean;
}

const VenueContext = createContext<VenueContextType>({
  currentVenueId: null,
  setCurrentVenueId: () => {},
  userVenues: [],
  isLoading: true
});

export const VenueProvider: React.FC = ({ children }) => {
  const [currentVenueId, setCurrentVenueId] = useState<number | null>(null);
  const [userVenues, setUserVenues] = useState<Venue[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load user's venues
    const fetchUserVenues = async () => {
      try {
        const response = await fetch('/api/user/venues');
        if (response.ok) {
          const venues = await response.json();
          setUserVenues(venues);
          
          // Set default venue if available
          if (venues.length > 0 && !currentVenueId) {
            const savedVenueId = localStorage.getItem('wakebookCurrentVenue');
            if (savedVenueId && venues.some(v => v.id === parseInt(savedVenueId))) {
              setCurrentVenueId(parseInt(savedVenueId));
            } else {
              setCurrentVenueId(venues[0].id);
            }
          }
        }
      } catch (error) {
        console.error("Error fetching user venues:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserVenues();
  }, []);

  const handleSetVenue = (venueId: number) => {
    setCurrentVenueId(venueId);
    localStorage.setItem('wakebookCurrentVenue', venueId.toString());
  };

  return (
    <VenueContext.Provider value={{
      currentVenueId,
      setCurrentVenueId: handleSetVenue,
      userVenues,
      isLoading
    }}>
      {children}
    </VenueContext.Provider>
  );
};

export const useVenue = () => useContext(VenueContext);
```

### 3. Venue Selector Component

```typescript
import { useVenue } from '@/context/venue-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function VenueSelector() {
  const { currentVenueId, setCurrentVenueId, userVenues, isLoading } = useVenue();

  if (isLoading) {
    return <div>Loading venues...</div>;
  }

  if (userVenues.length <= 1) {
    return null; // Don't show selector if user only has access to one venue
  }

  return (
    <Select value={currentVenueId?.toString()} onValueChange={(value) => setCurrentVenueId(parseInt(value))}>
      <SelectTrigger className="w-[200px]">
        <SelectValue placeholder="Select venue" />
      </SelectTrigger>
      <SelectContent>
        {userVenues.map(venue => (
          <SelectItem key={venue.id} value={venue.id.toString()}>
            {venue.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### 4. API Routes for Venue Management

```typescript
// Get all venues (platform admin only)
app.get("/api/venues", async (req, res) => {
  if (!req.isAuthenticated() || !isPlatformAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const venues = await db.select().from(venues);
  return res.json(venues);
});

// Get venues for authenticated user
app.get("/api/user/venues", async (req, res) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  const userVenueRoles = await db.select()
    .from(userVenueRoles)
    .where(eq(userVenueRoles.userId, req.user.id));
    
  if (userVenueRoles.length === 0) {
    return res.json([]);
  }
  
  const venueIds = userVenueRoles.map(uvr => uvr.venueId);
  
  const userVenues = await db.select()
    .from(venues)
    .where(inArray(venues.id, venueIds));
    
  return res.json(userVenues);
});

// Create a new venue (platform admin only)
app.post("/api/venues", async (req, res) => {
  if (!req.isAuthenticated() || !isPlatformAdmin(req.user)) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  
  const venueSchema = z.object({
    name: z.string().min(1),
    slug: z.string().regex(/^[a-z0-9-]+$/),
    timezone: z.string(),
    // ... other fields
  });
  
  try {
    const venueData = venueSchema.parse(req.body);
    const [newVenue] = await db.insert(venues).values(venueData).returning();
    
    // Also create default settings
    await db.insert(venueSettings).values({
      venueId: newVenue.id
    });
    
    // Add creator as venue owner
    await db.insert(userVenueRoles).values({
      userId: req.user.id,
      venueId: newVenue.id,
      role: 'venue_owner'
    });
    
    return res.status(201).json(newVenue);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
});
```

### 5. Venue-specific Data Fetching

Update all data fetching to include venue filtering:

```typescript
// Updated time slot fetching
app.get("/api/venues/:venueId/timeslots", async (req, res) => {
  const venueId = parseInt(req.params.venueId);
  const startDateStr = req.query.startDate as string;
  const endDateStr = req.query.endDate as string;
  
  // Validate date inputs
  if (startDateStr && !validateDate(startDateStr)) {
    return res.status(400).json({ error: "Invalid start date format" });
  }
  
  if (endDateStr && !validateDate(endDateStr)) {
    return res.status(400).json({ error: "Invalid end date format" });
  }
  
  try {
    // Get time slots for the specific venue
    const timeSlotData = await db.select()
      .from(timeSlots)
      .where(
        and(
          eq(timeSlots.venueId, venueId),
          gte(timeSlots.startTime, new Date(startDateStr)),
          lte(timeSlots.endTime, new Date(endDateStr))
        )
      );
      
    return res.json(timeSlotData);
  } catch (error) {
    console.error("Error fetching time slots:", error);
    return res.status(500).json({ error: "Failed to fetch time slots" });
  }
});
```

## Implementation Plan

1. **Week 1**: Database schema updates and migrations
2. **Week 2**: Authentication and authorization system updates
3. **Week 3**: API endpoint modifications for venue-specific access
4. **Week 4**: Frontend venue context and selector implementation
5. **Week 5**: Admin interface for venue management
6. **Week 6**: Testing and refinement

## Testing Strategy

1. **Unit Tests**: Test venue-specific authorization logic
2. **Integration Tests**: Verify proper data isolation between venues
3. **UI Tests**: Confirm venue switching and context preservation
4. **Performance Tests**: Measure impact of multi-tenancy on query performance
5. **Security Tests**: Ensure proper isolation of data between venues

## Deployment Considerations

- Schema migration should preserve existing data
- Consider sharding strategies for large-scale deployments
- Implement proper indexing for venue-filtered queries
- Consider caching strategies per venue