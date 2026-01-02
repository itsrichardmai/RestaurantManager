# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Restaurant Shift Scheduler - A web application for restaurant managers to automatically generate weekly staff schedules based on worker availability, skill levels, and shift requirements.

## Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Supabase (PostgreSQL + Auto-generated REST API)
- **Styling**: TailwindCSS
- **Scheduling Logic**: Client-side JavaScript

## Commands

```bash
npm run dev      # Start development server (http://localhost:5173)
npm run build    # Production build to dist/
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Architecture

### Database Tables (Supabase)

- `workers` - Staff members with name, skill_level (1-5), is_manager flag, and availability (boolean per day)
- `shift_requirements` - How many workers needed per day/shift
- `schedule_assignments` - Generated schedule linking workers to days/shifts by week

### Component Structure

```
src/
├── App.jsx                      # Main layout, state for schedule refresh
├── supabaseClient.js            # Supabase connection (uses env vars)
├── components/
│   ├── WorkerManager.jsx        # CRUD for workers, availability toggles
│   ├── ShiftConfig.jsx          # Edit required workers per day
│   ├── ScheduleGenerator.jsx    # Triggers schedule generation
│   └── ScheduleView.jsx         # Weekly calendar grid display
└── utils/
    └── scheduler.js             # Scheduling algorithm
```

### Scheduling Algorithm (`src/utils/scheduler.js`)

The `generateSchedule()` function:
1. Iterates through each day of the week
2. Filters workers by availability for that day
3. Scores workers: `(skill_level * 2) - (shifts_already_assigned * 0.5)` for fairness
4. Assigns top N workers based on shift requirements
5. Returns assignments and warnings (when not enough workers available)

## Environment Variables

Copy `.env.example` to `.env` and configure:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Supabase Setup

Run this SQL in Supabase SQL Editor to create tables:

```sql
-- Workers table
CREATE TABLE workers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  skill_level INTEGER CHECK (skill_level BETWEEN 1 AND 5) NOT NULL,
  is_manager BOOLEAN DEFAULT false,
  monday BOOLEAN DEFAULT true,
  tuesday BOOLEAN DEFAULT true,
  wednesday BOOLEAN DEFAULT true,
  thursday BOOLEAN DEFAULT true,
  friday BOOLEAN DEFAULT true,
  saturday BOOLEAN DEFAULT true,
  sunday BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shift requirements (supports multiple shifts per day with hours)
CREATE TABLE shift_requirements (
  id BIGSERIAL PRIMARY KEY,
  day_of_week TEXT NOT NULL,
  shift_name TEXT NOT NULL DEFAULT 'day',
  start_time TIME NOT NULL DEFAULT '09:00',
  end_time TIME NOT NULL DEFAULT '17:00',
  required_workers INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generated schedules
CREATE TABLE schedule_assignments (
  id BIGSERIAL PRIMARY KEY,
  worker_id BIGINT REFERENCES workers(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  shift_name TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default shift requirements (day and night shifts)
INSERT INTO shift_requirements (day_of_week, shift_name, start_time, end_time, required_workers) VALUES
('monday', 'day', '09:00', '17:00', 2),
('monday', 'night', '17:00', '23:00', 2),
('tuesday', 'day', '09:00', '17:00', 2),
('tuesday', 'night', '17:00', '23:00', 2),
('wednesday', 'day', '09:00', '17:00', 3),
('wednesday', 'night', '17:00', '23:00', 2),
('thursday', 'day', '09:00', '17:00', 3),
('thursday', 'night', '17:00', '23:00', 2),
('friday', 'day', '09:00', '17:00', 4),
('friday', 'night', '17:00', '23:00', 3),
('saturday', 'day', '09:00', '17:00', 4),
('saturday', 'night', '17:00', '23:00', 3),
('sunday', 'day', '09:00', '17:00', 4),
('sunday', 'night', '17:00', '23:00', 2);

-- Disable RLS for MVP
ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE shift_requirements DISABLE ROW LEVEL SECURITY;
ALTER TABLE schedule_assignments DISABLE ROW LEVEL SECURITY;
```

## Key Patterns

- All Supabase operations use the singleton client from `supabaseClient.js`
- Components fetch their own data in `useEffect` on mount
- `ScheduleView` refreshes via `refreshTrigger` prop from parent
- Schedule is regenerated fresh each time (deletes old, inserts new)
- Week identification uses Monday's date via `getCurrentWeekStart()`
