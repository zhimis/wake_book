# WakeBook - Wakeboarding Park Booking System

WakeBook is a mobile-first web application designed for wakeboarding parks with a 2-tower system. The application allows customers to view available time slots, book wakeboarding sessions, and provides administrators with comprehensive management capabilities.

## Features

### Customer Features

- **Weekly Calendar View**: Browse available time slots in a mobile-friendly weekly view
- **Dynamic Pricing**: See clear pricing for each 30-minute time slot
- **Multi-Slot Selection**: Book consecutive time slots in a single session
- **Temporary Reservation**: Selected slots are held for 10 minutes during booking
- **Weather Integration**: View current week's weather forecast
- **Responsive Design**: Optimized for mobile and desktop devices
- **Booking Management**: Complete booking with customer information and equipment rental options
- **Booking Confirmation**: Receive booking reference and add to calendar

### Administrator Features

- **Booking Management**: View, create, modify, and delete bookings
- **System Configuration**: Set operating hours, pricing, and calendar visibility
- **Statistics Dashboard**: View booking rates, income forecasts, and usage patterns
- **Secure Authentication**: Protected admin functionality

## Tech Stack

- **Frontend**:
  - React
  - Tailwind CSS
  - Shadcn UI components
  - TanStack React Query
  - Wouter for routing

- **Backend**:
  - Node.js with Express
  - In-memory data storage
  - RESTful API endpoints

## Installation and Setup

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/wakebook.git
   cd wakebook
   