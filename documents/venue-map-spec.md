# Wakepark/Venue Map Technical Specification

## Overview

This document outlines the technical approach to implementing an interactive venue map functionality in the WakeBook application. This feature will allow wakeboard parks to create visual representations of their facilities, enabling customers to visualize the venue and select specific resources for booking.

## Technical Requirements

### Core Functionality

- Interactive venue map displaying park layout
- Visual representation of bookable resources (wake cables, obstacles, etc.)
- Real-time availability status indicators
- Admin interface for map creation and management
- Mobile-friendly interactive display with zooming and panning

### Integration Points

- Connection between map resources and bookable time slots
- Visual status indicators tied to booking system
- Map-based booking initiation

## Technology Selection

The implementation will use:

- **SVG** for map rendering and interactivity
- **React State** for managing interactions
- **react-zoom-pan-pinch** for mobile-friendly zooming
- **Tailwind CSS** for styling

## Data Model Additions

### Map Definition

```typescript
export const venueMaps = pgTable('venue_maps', {
  id: serial('id').primaryKey(),
  venueId: integer('venue_id').references(() => venues.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  svgData: text('svg_data').notNull(), // Store the SVG XML
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

export type VenueMap = typeof venueMaps.$inferSelect;
export type InsertVenueMap = typeof venueMaps.$inferInsert;
```

### Map Resources

```typescript
export const mapResourceTypes = pgEnum('map_resource_type', [
  'cable',
  'obstacle',
  'feature',
  'facility',
  'area'
]);

export const mapResources = pgTable('map_resources', {
  id: serial('id').primaryKey(),
  mapId: integer('map_id').references(() => venueMaps.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  resourceType: mapResourceTypes('resource_type').notNull(),
  svgElementId: text('svg_element_id').notNull(), // ID of the SVG element in the map
  isBookable: boolean('is_bookable').default(false),
  bookingResourceId: integer('booking_resource_id'), // Optional reference to a bookable resource
  displayOrder: integer('display_order').default(0),
  customProps: jsonb('custom_props') // For storing additional resource-specific properties
});

export type MapResource = typeof mapResources.$inferSelect;
export type InsertMapResource = typeof mapResources.$inferInsert;
```

### Bookable Resources

```typescript
export const bookableResources = pgTable('bookable_resources', {
  id: serial('id').primaryKey(),
  venueId: integer('venue_id').references(() => venues.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  description: text('description'),
  resourceType: text('resource_type').notNull(), // Type of resource (cable, obstacle, etc.)
  capacity: integer('capacity').default(1).notNull(), // How many people can use at once
  isActive: boolean('is_active').default(true),
  defaultPriceModifier: numeric('default_price_modifier').default(0) // Adjust price for this resource
});

// Add resource association to time slots
export const timeSlotResources = pgTable('time_slot_resources', {
  id: serial('id').primaryKey(),
  timeSlotId: integer('time_slot_id').references(() => timeSlots.id, { onDelete: 'cascade' }).notNull(),
  resourceId: integer('resource_id').references(() => bookableResources.id, { onDelete: 'cascade' }).notNull()
});
```

## Implementation Details

### 1. Map Editor Component

```typescript
import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';

// SVG drawing and editing libraries
import { createSvgElement, updateSvgElement, deleteSvgElement } from '@/lib/svg-utils';

interface MapEditorProps {
  venueId: number;
  initialMapData?: VenueMap;
  onSave: (mapData: InsertVenueMap) => Promise<void>;
}

export function MapEditor({ venueId, initialMapData, onSave }: MapEditorProps) {
  const [activeTab, setActiveTab] = useState<string>('draw');
  const [mapName, setMapName] = useState<string>(initialMapData?.name || 'New Map');
  const [selectedTool, setSelectedTool] = useState<string>('select');
  const [selectedElement, setSelectedElement] = useState<SVGElement | null>(null);
  const [elementProperties, setElementProperties] = useState<Record<string, any>>({});
  
  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  
  // Initialize SVG canvas
  useEffect(() => {
    if (initialMapData && svgRef.current) {
      // Load existing SVG data
      svgRef.current.innerHTML = initialMapData.svgData;
      
      // Setup event listeners for existing elements
      setupSvgElementListeners();
    }
  }, [initialMapData]);
  
  const setupSvgElementListeners = () => {
    if (!svgRef.current) return;
    
    const elements = svgRef.current.querySelectorAll('rect, circle, path, polygon');
    elements.forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedTool === 'select') {
          setSelectedElement(el as SVGElement);
          loadElementProperties(el as SVGElement);
        }
      });
    });
  };
  
  const loadElementProperties = (element: SVGElement) => {
    const props: Record<string, any> = {
      id: element.id,
      type: element.tagName.toLowerCase(),
    };
    
    // Add type-specific properties
    if (element.tagName === 'RECT') {
      const rect = element as SVGRectElement;
      props.x = rect.x.baseVal.value;
      props.y = rect.y.baseVal.value;
      props.width = rect.width.baseVal.value;
      props.height = rect.height.baseVal.value;
    } else if (element.tagName === 'CIRCLE') {
      const circle = element as SVGCircleElement;
      props.cx = circle.cx.baseVal.value;
      props.cy = circle.cy.baseVal.value;
      props.r = circle.r.baseVal.value;
    }
    
    // Add style properties
    props.fill = element.getAttribute('fill') || '#000000';
    props.stroke = element.getAttribute('stroke') || 'none';
    props.strokeWidth = element.getAttribute('stroke-width') || '1';
    
    // Add data attributes
    Array.from(element.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .forEach(attr => {
        props[attr.name] = attr.value;
      });
    
    setElementProperties(props);
  };
  
  const handleAddElement = (type: string) => {
    if (!svgRef.current) return;
    
    const newElement = createSvgElement(type, { 
      id: `element-${Date.now()}`,
      'data-resource-type': 'feature',
      'data-is-bookable': 'false'
    });
    
    svgRef.current.appendChild(newElement);
    setupSvgElementListeners();
    setSelectedElement(newElement);
    loadElementProperties(newElement);
  };
  
  const handlePropertyChange = (property: string, value: string) => {
    if (!selectedElement) return;
    
    setElementProperties(prev => ({ ...prev, [property]: value }));
    
    // Update the SVG element
    if (property.startsWith('data-')) {
      selectedElement.setAttribute(property, value);
    } else if (['fill', 'stroke', 'stroke-width'].includes(property)) {
      selectedElement.setAttribute(property, value);
    } else {
      // Handle geometry properties based on element type
      updateSvgElement(selectedElement, property, value);
    }
  };
  
  const handleSaveMap = async () => {
    if (!svgRef.current) return;
    
    // Get SVG content
    const svgContent = svgRef.current.outerHTML;
    
    // Create map data object
    const mapData: InsertVenueMap = {
      venueId,
      name: mapName,
      description: '',
      svgData: svgContent,
      width: svgRef.current.viewBox.baseVal.width,
      height: svgRef.current.viewBox.baseVal.height,
      isActive: true
    };
    
    // Call onSave callback
    await onSave(mapData);
  };
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center space-x-4">
          <Label htmlFor="mapName">Map Name:</Label>
          <Input 
            id="mapName" 
            value={mapName} 
            onChange={(e) => setMapName(e.target.value)} 
            className="w-64"
          />
        </div>
        <Button onClick={handleSaveMap}>Save Map</Button>
      </div>
      
      <div className="flex h-full">
        <div className="w-64 border-r p-4">
          <Tabs defaultValue="draw" onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="draw" className="flex-1">Draw</TabsTrigger>
              <TabsTrigger value="resources" className="flex-1">Resources</TabsTrigger>
            </TabsList>
            
            <TabsContent value="draw" className="mt-4">
              <div className="flex flex-col space-y-2">
                <Button 
                  variant={selectedTool === 'select' ? 'default' : 'outline'} 
                  onClick={() => setSelectedTool('select')}
                  className="justify-start"
                >
                  <span className="mr-2">🔍</span> Select
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleAddElement('rect')}
                  className="justify-start"
                >
                  <span className="mr-2">□</span> Rectangle
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleAddElement('circle')}
                  className="justify-start"
                >
                  <span className="mr-2">○</span> Circle
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleAddElement('polygon')}
                  className="justify-start"
                >
                  <span className="mr-2">△</span> Polygon
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => handleAddElement('path')}
                  className="justify-start"
                >
                  <span className="mr-2">✎</span> Path
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="resources" className="mt-4">
              {/* Resource configuration UI */}
              <div className="text-sm text-muted-foreground mb-4">
                Configure map elements as bookable resources
              </div>
              {/* Resource list would go here */}
            </TabsContent>
          </Tabs>
          
          {selectedElement && (
            <div className="mt-8 border-t pt-4">
              <h3 className="font-medium mb-2">Element Properties</h3>
              {/* Property editor would go here */}
              <div className="space-y-3">
                <div>
                  <Label htmlFor="element-id">ID</Label>
                  <Input 
                    id="element-id" 
                    value={elementProperties.id || ''} 
                    onChange={(e) => handlePropertyChange('id', e.target.value)} 
                  />
                </div>
                
                <div>
                  <Label htmlFor="element-fill">Fill Color</Label>
                  <div className="flex space-x-2">
                    <Input 
                      id="element-fill" 
                      value={elementProperties.fill || '#000000'} 
                      onChange={(e) => handlePropertyChange('fill', e.target.value)} 
                    />
                    <input 
                      type="color" 
                      value={elementProperties.fill || '#000000'} 
                      onChange={(e) => handlePropertyChange('fill', e.target.value)} 
                      className="w-10 h-10"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="element-resource-type">Resource Type</Label>
                  <select
                    id="element-resource-type"
                    value={elementProperties['data-resource-type'] || 'feature'}
                    onChange={(e) => handlePropertyChange('data-resource-type', e.target.value)}
                    className="w-full p-2 border rounded"
                  >
                    <option value="cable">Cable</option>
                    <option value="obstacle">Obstacle</option>
                    <option value="feature">Feature</option>
                    <option value="facility">Facility</option>
                    <option value="area">Area</option>
                  </select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="is-bookable"
                    checked={elementProperties['data-is-bookable'] === 'true'}
                    onChange={(e) => handlePropertyChange('data-is-bookable', e.target.checked ? 'true' : 'false')}
                  />
                  <Label htmlFor="is-bookable">Bookable Resource</Label>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="flex-1 p-4" ref={mapContainerRef}>
          <TransformWrapper>
            <TransformComponent>
              <svg 
                ref={svgRef} 
                width="800" 
                height="600" 
                viewBox="0 0 800 600"
                className="border bg-white"
              >
                {/* SVG content will be added here */}
              </svg>
            </TransformComponent>
          </TransformWrapper>
        </div>
      </div>
    </div>
  );
}
```

### 2. Map Display Component

```typescript
import React, { useEffect, useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';

interface VenueMapDisplayProps {
  venueId: number;
  mapId: number;
  onResourceSelect?: (resourceId: string) => void;
  showAvailability?: boolean;
  selectedDate?: Date;
}

export function VenueMapDisplay({
  venueId,
  mapId,
  onResourceSelect,
  showAvailability = true,
  selectedDate
}: VenueMapDisplayProps) {
  const [svgContent, setSvgContent] = useState<string>('');
  
  // Fetch map data
  const { data: mapData, isLoading: mapLoading } = useQuery({
    queryKey: ['/api/venues', venueId, 'maps', mapId],
    queryFn: async () => {
      const res = await fetch(`/api/venues/${venueId}/maps/${mapId}`);
      if (!res.ok) throw new Error('Failed to fetch map');
      return res.json();
    }
  });
  
  // Fetch availability data if showing availability
  const { data: availabilityData, isLoading: availabilityLoading } = useQuery({
    queryKey: ['/api/venues', venueId, 'resource-availability', selectedDate?.toISOString()],
    queryFn: async () => {
      const dateParam = selectedDate ? `?date=${selectedDate.toISOString()}` : '';
      const res = await fetch(`/api/venues/${venueId}/resource-availability${dateParam}`);
      if (!res.ok) throw new Error('Failed to fetch availability');
      return res.json();
    },
    enabled: showAvailability && !!selectedDate
  });
  
  useEffect(() => {
    if (mapData) {
      setSvgContent(mapData.svgData);
    }
  }, [mapData]);
  
  useEffect(() => {
    // Update SVG elements with availability data
    if (svgContent && availabilityData && showAvailability) {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
      
      // Loop through availability data and update element styles
      availabilityData.forEach((resource: any) => {
        const element = svgDoc.getElementById(resource.svgElementId);
        if (element) {
          // Update element based on availability
          if (resource.isAvailable) {
            element.setAttribute('data-status', 'available');
            element.setAttribute('fill-opacity', '1');
            element.setAttribute('stroke', '#10b981'); // Green outline
          } else {
            element.setAttribute('data-status', 'booked');
            element.setAttribute('fill-opacity', '0.5');
            element.setAttribute('stroke', '#ef4444'); // Red outline
          }
          element.setAttribute('stroke-width', '2');
        }
      });
      
      // Convert back to string
      const serializer = new XMLSerializer();
      setSvgContent(serializer.serializeToString(svgDoc.documentElement));
    }
  }, [svgContent, availabilityData, showAvailability]);
  
  const handleElementClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as SVGElement;
    
    // Check if clicked element is a resource
    if (target.hasAttribute('data-resource-type')) {
      const resourceId = target.id;
      const resourceType = target.getAttribute('data-resource-type');
      const isBookable = target.getAttribute('data-is-bookable') === 'true';
      
      if (isBookable && onResourceSelect) {
        onResourceSelect(resourceId);
      }
    }
  };
  
  if (mapLoading) {
    return <div className="flex items-center justify-center h-64">Loading map...</div>;
  }
  
  if (!mapData) {
    return <div className="flex items-center justify-center h-64">Map not found</div>;
  }
  
  return (
    <div className="relative rounded-lg overflow-hidden border bg-white">
      <div className="absolute top-2 right-2 z-10 flex space-x-2">
        <Button size="sm" variant="outline" className="bg-white/90">
          <span className="mr-1">➕</span> Zoom In
        </Button>
        <Button size="sm" variant="outline" className="bg-white/90">
          <span className="mr-1">➖</span> Zoom Out
        </Button>
        <Button size="sm" variant="outline" className="bg-white/90">
          <span className="mr-1">↺</span> Reset
        </Button>
      </div>
      
      <TransformWrapper
        initialScale={1}
        initialPositionX={0}
        initialPositionY={0}
      >
        {({ zoomIn, zoomOut, resetTransform }) => (
          <React.Fragment>
            <TransformComponent>
              <div 
                className="venue-map"
                dangerouslySetInnerHTML={{ __html: svgContent }}
                onClick={handleElementClick}
              />
            </TransformComponent>
          </React.Fragment>
        )}
      </TransformWrapper>
      
      {showAvailability && (
        <div className="absolute bottom-2 left-2 p-2 bg-white/90 rounded shadow-sm flex items-center space-x-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-green-500 rounded-full mr-1" />
            <span className="text-sm">Available</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 opacity-50 rounded-full mr-1" />
            <span className="text-sm">Booked</span>
          </div>
        </div>
      )}
    </div>
  );
}
```

### 3. Map Integration with Booking Flow

```typescript
import { useState } from 'react';
import { useVenue } from '@/context/venue-context';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import VenueMapDisplay from '@/components/map/venue-map-display';
import BookingCalendar from '@/components/booking-calendar';
import { format } from 'date-fns';

export function BookingPage() {
  const { currentVenueId } = useVenue();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedResource, setSelectedResource] = useState<string | null>(null);
  const [bookingView, setBookingView] = useState<'map' | 'calendar'>('calendar');
  
  // Fetch venue maps
  const { data: venueMaps } = useQuery({
    queryKey: ['/api/venues', currentVenueId, 'maps'],
    enabled: !!currentVenueId
  });
  
  const activeMapId = venueMaps?.[0]?.id;
  
  const handleResourceSelect = (resourceId: string) => {
    setSelectedResource(resourceId);
    // Switch to calendar view after resource selection
    setBookingView('calendar');
  };
  
  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Book Your Session</h1>
      
      <Tabs value={bookingView} onValueChange={(v) => setBookingView(v as 'map' | 'calendar')}>
        <div className="flex items-center justify-between mb-4">
          <TabsList>
            <TabsTrigger value="map">Park Map</TabsTrigger>
            <TabsTrigger value="calendar">Calendar</TabsTrigger>
          </TabsList>
          
          <div className="text-sm">
            {selectedResource ? (
              <span className="inline-flex items-center bg-blue-100 text-blue-800 px-3 py-1 rounded-full">
                Resource Selected: {selectedResource}
                <button 
                  className="ml-2 text-blue-600" 
                  onClick={() => setSelectedResource(null)}
                >
                  ✕
                </button>
              </span>
            ) : null}
          </div>
        </div>
        
        <TabsContent value="map" className="mt-4">
          <div className="mb-4">
            <h2 className="text-lg font-medium mb-2">Select a resource on the map</h2>
            <p className="text-muted-foreground">
              Click on a highlighted area to select a specific cable or feature for booking.
            </p>
          </div>
          
          {currentVenueId && activeMapId ? (
            <VenueMapDisplay
              venueId={currentVenueId}
              mapId={activeMapId}
              onResourceSelect={handleResourceSelect}
              showAvailability={true}
              selectedDate={selectedDate}
            />
          ) : (
            <div className="border rounded-lg p-8 text-center bg-muted">
              <p>No map available for this venue.</p>
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="calendar" className="mt-4">
          <BookingCalendar 
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
            resourceFilter={selectedResource ? [selectedResource] : undefined}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

### 4. Server-side Resource Availability API

```typescript
// Get resource availability for a specific date
app.get("/api/venues/:venueId/resource-availability", async (req, res) => {
  const venueId = parseInt(req.params.venueId);
  const dateStr = req.query.date as string || new Date().toISOString();
  
  try {
    // Get the date range (full day in Latvia timezone)
    const date = new Date(dateStr);
    const startTime = getLatviaDayStart(date);
    const endTime = getLatviaDayEnd(date);
    
    // First, get all resources for this venue
    const resources = await db.select()
      .from(mapResources)
      .innerJoin(venueMaps, eq(mapResources.mapId, venueMaps.id))
      .where(
        and(
          eq(venueMaps.venueId, venueId),
          eq(mapResources.isBookable, true)
        )
      );
    
    // Then, get all bookings for this date range that involve these resources
    const bookedResourceIds = await db.select({
      resourceId: bookableResources.id
    })
    .from(timeSlots)
    .innerJoin(timeSlotResources, eq(timeSlots.id, timeSlotResources.timeSlotId))
    .innerJoin(bookableResources, eq(timeSlotResources.resourceId, bookableResources.id))
    .where(
      and(
        eq(timeSlots.venueId, venueId),
        eq(timeSlots.status, 'booked'),
        gte(timeSlots.startTime, startTime),
        lte(timeSlots.endTime, endTime)
      )
    );
    
    // Create availability data
    const availabilityData = resources.map(resource => {
      const isBooked = bookedResourceIds.some(
        bookedResource => bookedResource.resourceId === resource.bookingResourceId
      );
      
      return {
        id: resource.id,
        name: resource.name,
        resourceType: resource.resourceType,
        svgElementId: resource.svgElementId,
        isAvailable: !isBooked
      };
    });
    
    return res.json(availabilityData);
  } catch (error) {
    console.error("Error fetching resource availability:", error);
    return res.status(500).json({ error: "Failed to fetch resource availability" });
  }
});
```

## Implementation Plan

1. **Week 1**: Create data models and schema migrations
2. **Week 2**: Build map editor component
3. **Week 3**: Implement map display component with interactivity
4. **Week 4**: Add resource availability visualization
5. **Week 5**: Integrate with booking flow
6. **Week 6**: Testing and refinement

## Testing Strategy

1. **User Testing**: Test map editor usability with administrators
2. **Interactive Testing**: Verify map interactions work as expected
3. **Mobile Testing**: Ensure proper functionality on mobile devices
4. **Performance Testing**: Verify SVG rendering performance with complex maps
5. **Integration Testing**: Test booking flow with map resource selection

## Deployment Considerations

- SVG data can be large; implement proper compression and caching
- Consider a phased rollout to specific venues first
- Provide templates and examples for venues to create their maps
- Consider implementing a drag-and-drop interface for easier map creation