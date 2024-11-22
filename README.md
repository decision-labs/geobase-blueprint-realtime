---
title: 'Shared Mouse Tracker'
description: 'A real-time interactive application for tracking mouse movements across multiple users'
---

# Shared Mouse Tracker

A real-time interactive application built using Next.js and Geobase that tracks mouse movements of multiple users and displays them on a shared canvas. The app features responsive design, real-time updates, and user-specific markers for enhanced clarity.

## Features

- **Real-Time Mouse Tracking**: Track and visualize user mouse movements on a shared canvas
- **Unique User Identification**: Session-specific user IDs generated using uuid
- **Live Updates**: Real-time data synchronization using Geobase
- **Responsive Design**: Mobile-friendly UI built with Tailwind CSS
- **Interactive Canvas**: Color-coded markers for different users (blue: current user, red: others)

## Tech Stack

- React
- Next.js
- Geobase
- Tailwind CSS
- uuid

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Geobase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/decision-labs/geobase-blueprint-realtime.git
cd geobase-blueprint-realtime
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:

Create a `.env.local` file in the project root:
```env
NEXT_PUBLIC_Geobase_URL=<your-Geobase-url>
NEXT_PUBLIC_Geobase_ANON_KEY=<your-Geobase-anon-key>
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

<Callout type="info">
  To test multi-user functionality, open the app in multiple browser windows or devices.
</Callout>

## Core Components

### Canvas Component

The main component responsible for displaying and tracking mouse movements:

```tsx
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  mouseMovements.forEach(({ x, y, user_id }) => {
    ctx.fillStyle = user_id === userId ? 'blue' : 'red';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  setStatus('Idle');
}, [mouseMovements, userId]);
```

### Real-Time Subscription

Implementation of Geobase's real-time subscription for mouse movements:

```tsx
useEffect(() => {
  const subscription = Geobase
    .channel('public:mouse_movements')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'mouse_movements' },
      (payload: { new: MouseMovement }) => {
        const newMovement = payload.new;
        setMouseMovements((prev) => [...prev, newMovement]);
      }
    )
    .subscribe();

  return () => {
    Geobase.removeChannel(subscription);
  };
}, []);
```

## Database Setup

Create the required table in your Geobase instance:

```sql
CREATE TABLE mouse_movements (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  x INT NOT NULL,
  y INT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## UI Components

### Badge
Displays user information and tracking status:
- Shows current user ID
- Indicates real-time tracking status (Idle/Tracking)

### Button
Provides canvas management functionality:
- Clear canvas option
- Styled with Tailwind CSS for consistent design

### Card
Main container component:
- Wraps the UI elements
- Ensures consistent spacing and layout
- Responsive design for all screen sizes

## Responsive Design

The application uses Tailwind CSS for a mobile-first approach:

- **Flexible Canvas**: Automatically scales to fit different screen sizes
- **Touch Support**: Works on mobile devices and tablets
- **Responsive Layout**: Adapts UI elements for optimal viewing on all devices
- **Interactive Elements**: Proper spacing for touch targets
- **Visual Feedback**: Hover and active states for better UX

