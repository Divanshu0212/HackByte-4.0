# Missing Features from Event Orchestration Spec

This document compares the original `eventorch.md` specification with the current implementation and lists features that are **not yet implemented**.

## ✅ What's Implemented

- ✅ Planning chat with streaming Gemini responses
- ✅ Event commit with AI-generated tasks
- ✅ Six-phase workflow (Permissions → Venue → Sponsors → Registrations → Volunteers → Go/No-Go)
- ✅ Role-based operator codes (director, venue_lead, sponsor_lead, tech_lead, volunteer_coord, volunteer)
- ✅ Task dependency resolution (two-pass depends_on_titles → task_ids)
- ✅ Task status management (locked/available/in_progress/completed/blocked)
- ✅ Checkpoint system with pass/fail logic
- ✅ Director dashboard with phase boards
- ✅ Volunteer task view with scoped access
- ✅ Task completion with automatic dependency unlocking
- ✅ Manual task add/edit/delete (just implemented)
- ✅ Progress tracking and visualization
- ✅ Access code authentication
- ✅ File-based persistence (survives server restarts)

---

## ❌ Missing Core Infrastructure

### 1. **SpacetimeDB Integration**
**Status**: ❌ Not Implemented
**Current**: Using file-based storage (`.data/orchestration/events.json`)
**Spec Requirement**: SpacetimeDB for real-time state synchronization

**What's Missing**:
- Real-time subscriptions across all clients
- Instant updates (< 300ms) when any operator completes a task
- SpacetimeDB Rust module with reducers
- Live state sync without polling

**Impact**: Currently the system requires manual refresh to see updates from other operators. The spec calls for automatic real-time updates visible across all connected clients instantly.

---


### 3. **Session Management with iron-session**
**Status**: ❌ Not Implemented
**Current**: Using localStorage for session storage
**Spec Requirement**: iron-session with signed cookies

**What's Missing**:
- Server-side session validation
- Signed cookie authentication
- Secure session payload: `{ operator_id, role, scope, event_id }`
- Protected API routes with session middleware

**Impact**: Session is client-side only, not validated on server. Could be spoofed or modified.

---

## ❌ Missing Features

### 4. **Announcements System**
**Status**: ❌ Not Implemented
**Spec Location**: Section 2.3, 3.1 (announcements table), 8.1, 8.2

**What's Missing**:
- `announcements` table in database
- POST /api/announce route
- AnnouncementBar component on dashboard
- Announcement composer UI
- Scheduled announcements
- Notification to all operators

**User Story**: Director should be able to send broadcast messages to all volunteers (e.g., "Meeting in 30 minutes", "Venue booking confirmed").

---

### 5. **Voice Announcements with ElevenLabs**
**Status**: ❌ Not Implemented
**Spec Location**: Section 2.1, 10.1, 10.3, 11 (Demo Script)

**What's Missing**:
- ElevenLabs Turbo v2 integration
- `speak()` utility function (`lib/speak.ts`)
- Voice on checkpoint pass
- Voice on Go/No-Go passed
- Browser SpeechSynthesis fallback

**User Story**: When director passes Go/No-Go checkpoint, ElevenLabs should announce: "All systems confirmed. [Event Name] is ready to launch."

**Current Workaround**: Simple browser `speechSynthesis` is used in dashboard, but not comprehensive.

---

### 6. **Operator Activity Feed**
**Status**: ❌ Not Implemented
**Spec Location**: Section 8.1 (Screen 2), 8.2

**What's Missing**:
- OperatorFeed component
- Live feed on dashboard showing "who did what, when"
- Real-time updates via SpacetimeDB subscription
- Activity timeline (e.g., "Venue Lead marked 'Book Hall' complete 2 minutes ago")

**User Story**: Director should see a live activity feed of all operator actions in real-time.

---

### 7. **Checkpoint Badge Component**
**Status**: ❌ Not Implemented
**Spec Location**: Section 8.2

**What's Missing**:
- CheckpointBadge component
- Visual indicator of checkpoint status with animations
- Color-coded badges (locked/available/passed/failed)

**Current**: Using simple Badge from shadcn/ui without custom checkpoint styling.

---

### 8. **Event Config Preview Card**
**Status**: ❌ Not Implemented
**Spec Location**: Section 8.1 (Screen 1), 8.2

**What's Missing**:
- EventConfigPreview component
- Preview card shown BEFORE committing event
- Review interface for tasks, phases, and role codes
- Edit-before-commit functionality

**Current**: Manager commits immediately without reviewing the generated structure in a dedicated preview UI.

---

### 9. **Flag Blocker Feature**
**Status**: ❌ Partially Implemented
**Spec Location**: Section 8.1 (Screen 3), 9

**What's Missing**:
- POST /api/flag route
- "Flag Blocker" button on volunteer task view
- Instant notification to director when task is flagged
- Visual indicator on director dashboard for flagged tasks

**Current**: Director can manually mark tasks as blocked via task management, but volunteers cannot flag blockers themselves.

---

### 10. **GET /api/event/[id] Route**
**Status**: ❌ Not Implemented
**Spec Location**: Section 9

**What's Missing**:
- GET endpoint to retrieve current event state snapshot
- Filtered response based on operator scope
- JSON response with event + scoped tasks

**Current**: Using `/api/orchestration/action?event_id=X&operator_id=Y` instead.

---

### 11. **Optimistic UI Updates**
**Status**: ❌ Not Implemented
**Spec Location**: Section 6.3

**What's Missing**:
- Local state update before server confirmation
- Revert logic if server-side action fails
- Instant feeling UI (update appears immediately, syncs in background)

**Current**: UI waits for server response before updating task status.

---

### 12. **Framer Motion Task Completion Animations**
**Status**: ❌ Partially Implemented
**Spec Location**: Section 2.1, 11

**What's Missing**:
- Task completion animation (checkmark fly-in, green pulse)
- Progress bar smooth transitions
- Phase unlock animations
- Checkpoint pass celebration animation

**Current**: Framer Motion is installed and used for page transitions, but no task-specific animations.

---

### 13. **DiceBear Avatars for Operators**
**Status**: ❌ Not Implemented
**Spec Location**: Section 10

**What's Missing**:
- DiceBear v7 integration
- Avatar generation from operator_id seed
- Operator avatars in activity feed
- Avatar display in task cards (who completed it)

---

### 14. **Operator Last Active Tracking**
**Status**: ⚠️ Code Exists, Not Used
**Spec Location**: Section 3.1 (operators table)

**What's Missing**:
- Display of "last seen" timestamps on dashboard
- Active/inactive operator indicators
- Auto-update last_active on every action

**Current**: `updateOperatorLastActive()` function exists but is not called anywhere.

---

## ⚠️ Architectural Differences

### Real-Time Sync
- **Spec**: SpacetimeDB subscriptions, instant updates < 300ms
- **Current**: File-based storage, updates require manual refresh or polling

### Database
- **Spec**: SpacetimeDB (live state) + MongoDB (history)
- **Current**: File-based JSON storage in `.data/orchestration/`

### Authentication
- **Spec**: iron-session with signed cookies
- **Current**: localStorage-based client-side session

---

## 📊 Feature Completion Summary

| Category | Implemented | Missing |
|----------|------------|---------|
| Core Workflow | 90% | 10% |
| Database Architecture | 0% | 100% |
| Real-Time Sync | 0% | 100% |
| Authentication | 50% | 50% |
| Voice & Announcements | 10% | 90% |
| UI Components | 70% | 30% |
| API Routes | 80% | 20% |

---

## 🎯 Priority Missing Features for Demo

If you want to match the demo script from Section 12:

1. **Critical for Demo**:
   - ❌ Voice announcement on Go/No-Go pass (ElevenLabs)
   - ❌ Real-time sync (SpacetimeDB) - "the volunteer marks done, manager sees it < 300ms"
   - ❌ Task completion animations (checkmark, progress bar smooth advance)

2. **Nice to Have**:
   - ❌ Operator activity feed (live "who did what")
   - ❌ Announcements system
   - ❌ Event config preview before commit

3. **Can Skip for Demo**:
   - ❌ MongoDB history/audit logs
   - ❌ DiceBear avatars
   - ❌ iron-session (localStorage works for demo)

---

## 📝 Notes

**What Works Well**:
- The core orchestration logic is solid
- AI agent generates realistic task structures
- Dependency locking works correctly
- File-based storage survives server restarts
- Role-based access control works
- Manual task management is functional

**What's Holding Back the Vision**:
- Lack of SpacetimeDB = no real-time collaboration
- Lack of voice = Go/No-Go moment loses impact
- Lack of activity feed = director has no visibility into operator actions

**Recommendation**: If targeting a demo, prioritize:
1. ElevenLabs voice on Go/No-Go checkpoint pass
2. Task completion animations (visual polish)
3. Operator activity feed (shows collaboration)
