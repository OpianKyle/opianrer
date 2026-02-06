# Opian Core - Customer Relationship Management System

## Overview

Opian Core is a modern, full-stack customer relationship management application built with React, TypeScript, and Express. The application provides comprehensive client management, document handling, appointment scheduling, and calendar functionality. It follows a clean architecture pattern with a clear separation between frontend and backend components.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **UI Components**: Radix UI primitives with custom styling

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Replit PostgreSQL (node-postgres)
- **File Handling**: Multer for file uploads
- **Session Management**: Express sessions with PostgreSQL storage
- **Development**: Vite for development server and HMR

## Key Components

### Database Schema
The application uses five main entities:
- **Clients**: Core customer information including name, email, company, status, and value
- **Documents**: File attachments linked to clients with metadata
- **Appointments**: Scheduled meetings with clients including time, type, status, and duration
- **Users**: Authentication and user management with role-based access control
- **Team Members**: Staff management with specific roles (CEO, Financial Advisor, Admin, IT) and department assignments

### API Structure
RESTful API endpoints organized by resource:
- `/api/clients` - Client CRUD operations
- `/api/documents` - Document upload and management
- `/api/appointments` - Appointment scheduling and management
- `/api/stats` - Dashboard statistics

### Storage Layer
Abstracted storage interface (`IStorage`) with PostgreSQL database implementation. The interface supports:
- Client management operations with persistent storage
- Document handling with file metadata and database relations
- Appointment scheduling and tracking with client associations
- Statistics aggregation from real database data
- Automatic database seeding with sample data for development

## Data Flow

1. **Client Request**: React components make API calls using TanStack Query
2. **API Layer**: Express routes handle requests and validate data using Zod schemas
3. **Storage Layer**: Abstracted storage interface processes business logic
4. **Database**: Drizzle ORM manages PostgreSQL interactions
5. **Response**: Data flows back through the same layers to update the UI

## External Dependencies

### Core Dependencies
- **pg**: PostgreSQL client for Node.js
- **drizzle-orm**: Type-safe database ORM
- **@tanstack/react-query**: Server state management
- **react-hook-form**: Form state management
- **zod**: Runtime type validation
- **multer**: File upload handling

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Icon library
- **wouter**: Lightweight routing

## Deployment Strategy

### Build Process
- **Frontend**: Vite builds React application to `dist/public`
- **Backend**: esbuild bundles Express server to `dist/index.js`
- **Database**: Drizzle migrations handle schema changes

### Environment Configuration
- **Development**: Uses Vite dev server with HMR and proxy
- **Production**: Serves static files from Express with bundled backend
- **Database**: Requires `DATABASE_URL` environment variable

### File Structure
```
├── client/          # React frontend
├── server/          # Express backend
├── shared/          # Shared types and schemas
├── migrations/      # Database migrations
└── dist/           # Build output
```

## Changelog

```
Changelog:
- July 07, 2025. Initial setup - Complete CRM system with client management, document handling, and appointment scheduling
- July 07, 2025. Enhanced dashboard - Added sophisticated UI with gradient cards, enhanced client activity display, performance insights, and modern visual design
- July 07, 2025. Database integration - Migrated from in-memory storage to PostgreSQL with Drizzle ORM, added database relations, and automatic seeding
- July 07, 2025. Authentication system - Added complete user authentication with login/register pages, protected routes, user-specific data filtering, and PostgreSQL session management
- July 07, 2025. Rebranding - Renamed application from "CRM Hub" to "Opian Core"
- July 07, 2025. Booking system enhancement - Transformed appointment scheduling into comprehensive booking system with step-by-step interface, real-time availability, visual indicators, and full appointment duration blocking
- July 07, 2025. Role-based team management - Added specific team member roles (CEO, Financial Advisor, Admin, IT) with color-coded visual system throughout the application
- July 08, 2025. User management unification - Merged team members and users into single concept using users table only, removed team_members table, added super admin user management capabilities with edit/delete permissions
- July 09, 2025. Real-time presence tracking - Added WebSocket-based online presence system showing who is online and their last seen status, with real-time updates for team member activities
- July 09, 2025. Role-based access control - Implemented admin and super user privileges allowing them to view all clients, documents, appointments, stats, and kanban boards across all users instead of just their own data
- July 10, 2025. Document management restructuring - Removed standalone documents page and integrated client-specific document management directly into client profiles with upload, download, and delete functionality
- July 10, 2025. Theme system enhancement - Made all pages fully theme-aware with Dashboard, Clients, Kanban, and Appointments pages now properly responding to theme changes including backgrounds, cards, text colors, and the new Pink theme
- July 10, 2025. Complete theme system integration - Added comprehensive theme support across all remaining components including Quick Actions, Today's Schedule, Kanban columns/cards, and Team Members page with stained glass effects, smooth 300ms transitions, and full compatibility with all theme colors
- July 10, 2025. Appointments and booking system theme integration - Updated appointments page, calendar components, and booking system with full theme awareness including stained glass backgrounds, dynamic color coordination, and responsive theme switching for all text, cards, and interactive elements
- July 17, 2025. Project migration - Successfully migrated Opian Core from Replit Agent to standard Replit environment with all functionality preserved, database connected, and authentication working properly
- July 17, 2025. Calendar visibility enhancement - Modified appointment system to allow all users to see all appointments on the calendar regardless of their role or who created them
- July 17, 2025. Team member color coding - Added distinct color indicators for each team member on both the calendar and appointments pages, with a visual legend showing which colors represent which team members
- July 17, 2025. Database storage fix - Fixed issue where non-required client information wasn't being saved properly by updating the createClient and updateClient methods to handle all optional fields and type conversion correctly
- July 17, 2025. Comprehensive client editing and visibility - Replaced edit client modal with complete comprehensive form matching add client format with all tabs and fields; enabled all team members to see all clients with 'Created By' column showing which team member added each client
- July 17, 2025. Calendar view enhancements - Added daily, weekly, and monthly view modes to the calendar with proper navigation controls and view-specific rendering for improved appointment visibility and scheduling
- July 21, 2025. Booking calendar enhancements - Added team member color coding for appointments across all calendar views with distinct colors for each team member, implemented hourly row structure for weekly calendar view with 24-hour time slots, and added team member color legend showing which colors represent which team members
- July 21, 2025. Push notifications and mobile responsiveness - Added push notification permission requests on login/registration, implemented mobile-responsive design with hamburger menu for sidebar navigation, responsive spacing and layouts for all pages, and mobile-friendly header with adaptive controls
- July 21, 2025. Email notifications and menu cleanup - Removed "Book Appointment" sidebar menu item, integrated Nodemailer for automatic email notifications when appointments are created/updated/deleted, sending professional emails to both clients and assigned team members with appointment details
- July 22, 2025. Production asset handling fix - Fixed issue where static assets (logo.png, etc.) weren't loading in production after npm build and npm start; created copy-assets.js script and build-production.sh automation to ensure all public assets are properly copied to dist/public directory
- July 23, 2025. Mobile responsiveness enhancement - Made authentication pages and dashboard fully mobile responsive with adaptive layouts, proper spacing, and mobile-optimized components; improved sidebar hamburger menu behavior and header mobile layout
- July 25, 2025. Database migration to Replit PostgreSQL - Successfully migrated from Neon Database to Replit's built-in PostgreSQL service due to quota limitations; updated database connection from serverless to node-postgres, maintained all schema and functionality with automatic seeding
- July 25, 2025. Neon Database restoration - Successfully connected to user's specific Neon database, migrated all table schemas and seeded with sample data, fully operational with WebSocket configuration
- July 25, 2025. Neon Database restoration - Successfully connected to user's specific Neon database, migrated all table schemas and seeded with sample data, fully operational with WebSocket configuration
- February 06, 2026. Project re-import to Replit - Migrated database connection from Neon serverless to Replit built-in PostgreSQL with node-postgres driver, provisioned database, pushed schema, verified application running correctly
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```