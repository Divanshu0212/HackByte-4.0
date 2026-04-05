# ⚡ **ELIXA**
## Event Orchestration Platform

> _Describe your event. Watch it come alive._

**Technical Implementation Document**  
HackByte 4.0 | PDPM IIITDM Jabalpur | MLH Official 2026 Season

---

## 🎯 **1. Project Overview**

### **What is Elixa?**

Elixa is an **event orchestration platform** powered by a master AI agent. It transforms chaotic WhatsApp coordination into structured, real-time task management for hackathon and college fest organizers.

### **The Problem We Solve**

Before any major event, organizing teams juggle **30-60 critical tasks**:
- 📋 Institute permissions & approvals
- 🏢 Venue booking & logistics  
- 💰 Sponsor outreach & confirmations
- 📝 Registration setup & management
- 👥 Volunteer coordination & briefing
- ⚡ Tech infrastructure & final Go/No-Go

**Current Reality:** One person holds everything in their head. WhatsApp chaos. Tasks fall through cracks.

### **Our Solution: The Checklist-to-Checkpoint Pipeline**

| **Phase** | **Owner** | **What Happens** |
|-----------|-----------|------------------|
| 🛡️ **Permissions** | Director | Institute approvals, date confirmations |
| 🏢 **Venue** | Venue Lead | Hall booking, AV setup, layout planning |
| 💰 **Sponsors** | Sponsor Lead | Outreach, follow-ups, commitment tracking |
| 📝 **Registrations** | Tech Lead | Platform setup, team shortlisting |
| 👥 **Volunteers** | Volunteer Coord | Briefings, role assignments, schedules |
| 🚀 **Go/No-Go** | Director | Final review & launch readiness |

---

## 🏗️ **2. System Architecture**

### **Tech Stack Overview**

| **Layer** | **Technology** | **Role** |
|-----------|----------------|----------|
| 🎨 **Frontend** | Next.js 14 + Tailwind CSS v3 | Manager dashboard, volunteer views |
| 🗄️ **Database** | **🔥 MongoDB Atlas** | Task sync, event history, audit trails |
| 🤖 **AI Engine** | **✨ Gemini 2.5 Flash** | Event parsing, task generation |
| 🎭 **UI/UX** | shadcn/ui + Framer Motion | Glassy effects, smooth animations |
| 🎤 **Voice** | **🔊 ElevenLabs Turbo v2** | Announcements, checkpoint narration |
| 🔐 **Auth** | Firebase + localStorage | Google sign-in, role-based access |

> **⚠️ Note:** Uses Tailwind CSS v3 (NOT v4) for shadcn/ui compatibility

### **Request Flow Architecture**

```mermaid
graph TD
    A[Manager describes event] --> B[Gemini 2.5 Flash parses]
    B --> C[EventConfig generated]
    C --> D[MongoDB stores tasks]
    D --> E[Role codes created]
    E --> F[Team coordination begins]
Critical API Separation:

/api/orchestration/plan → ✨ Gemini streaming only
/api/orchestration/commit → 🔥 MongoDB writes only
🗄️ 3. Database Design
MongoDB Collections
📊 orchestration_events
{
  event_id: string,
  name: string,
  description: string,
  date: number,
  venue: string,
  participant_count: number,
  status: 'planning' | 'active' | 'completed',
  director_id: string,
  
  tasks: [/* Task objects with dependencies */],
  operators: [/* Role-based access codes */],
  checkpoints: [/* Phase completion gates */]
}
📝 orchestration_task_history
{
  task_id: string,
  event_id: string,
  from_status: string,
  to_status: string,
  changed_by: string,
  timestamp: number
}
🚨 Critical: ✨ Gemini returns depends_on_titles as strings. Must resolve to task_ids before 🔥 MongoDB storage.

🤖 4. AI Agent Integration
Gemini 2.5 Flash System Prompt
You are Elixa's event planning agent. Parse plain English event descriptions into structured JSON.

RULES:
1. Ask max 2 clarifying questions if critical info missing
2. Generate realistic deadlines relative to event date  
3. Always include Go/No-Go phase as final checkpoint
4. Assign every task to a role - never leave empty
5. Output ONLY valid JSON - no markdown, no explanation

PHASES: permissions → venue → sponsors → registrations → volunteers → gonogo
Temperature: 0.2 for consistent JSON output

Two-Pass Dependency Resolution
The system resolves task dependencies in two passes:

First Pass: Generate all task IDs, build title→ID mapping
Second Pass: Resolve depends_on_titles to actual task_ids
⚡ 5. Real-Time Synchronization
MongoDB Polling Strategy
Since we use 🔥 MongoDB (not SpacetimeDB), real-time updates achieved through:

⚡ Optimistic UI updates for instant feedback
🔄 5-second polling for data freshness
📱 localStorage sessions for operator state
🎯 Manual refresh triggers on critical actions
Update Timeline
| Action | Sync Time | Path | |------------|---------------|----------| | Task completion | ~5 seconds | Client → API → 🔥 MongoDB → polling | | Checkpoint pass | ~5 seconds | Client → API → 🔥 MongoDB → polling | | AI task generation | 2-8 seconds | ✨ Gemini → parse → 🔥 MongoDB | | Voice announcements | ~6 seconds | 🔥 MongoDB + 🔊 ElevenLabs |

🔐 6. Role-Based Access Control
Access Hierarchy
| Role | Code Format | Scope | Permissions | |----------|-----------------|-----------|-----------------| | 👑 Director | DIR-XXXX | All phases | Create, pass checkpoints, override | | 🏢 Venue Lead | OP-VEN-XXXX | Venue only | Mark venue tasks, add notes | | 💰 Sponsor Lead | OP-SPO-XXXX | Sponsors only | Track sponsor confirmations | | 💻 Tech Lead | OP-TEC-XXXX | Registrations | Manage tech tasks | | 👥 Vol Coordinator | OP-VOL-XXXX | Volunteers | Coordinate team assignments | | 🙋 Volunteer | OP-V-XXXX | Assigned tasks | Complete own tasks |

Login Flow
Enter access code → 🔥 MongoDB lookup
Create localStorage session
Redirect to role-appropriate dashboard
All API calls include operator context
🎨 7. Frontend Architecture
Three Core Screens
🎯 Screen 1: Manager Setup Chat
Path: /event-orchestration/setup
✨ Gemini streaming conversation
EventConfig preview before commit
Generated operator codes display
📊 Screen 2: Manager Dashboard
Path: /event-orchestration/dashboard/[event_id]
Horizontal phase cards with progress
Live completion percentage
Operator activity feed
✅ Screen 3: Volunteer Task View
Path: /event-orchestration/volunteer/[event_id]
Scope-filtered task list
Available/locked/completed states
Notes and blocker flagging
Key Components
| Component | Purpose | |---------------|-------------| | PlanningChat | ✨ Gemini streaming interface | | EventConfigPreview | Task structure preview | | PhaseBoard | Dashboard phase cards | | TaskCard | Individual task management | | ProgressRing | Animated completion tracking |

🎭 Glassy Design System
.glass-card {
  backdrop-filter: blur(12px);
  background: rgba(26, 21, 40, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(31, 38, 135, 0.5);
}

.glass-text {
  background: linear-gradient(135deg, rgba(255, 255, 255, 1), rgba(255, 255, 255, 0.85));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  text-shadow: 0 0 25px rgba(124, 58, 237, 0.6);
}
🛠️ 8. API Routes
| Endpoint | Auth | Function | |--------------|----------|--------------| | POST /api/orchestration/plan | None | ✨ Gemini streaming (no DB writes) | | POST /api/orchestration/commit | Director | 🔥 MongoDB EventConfig storage | | POST /api/orchestration/auth | None | Access code validation | | POST /api/orchestration/action | Operator | Task completion, flagging | | POST /api/orchestration/checkpoint | Director | Phase checkpoint control | | GET /api/orchestration/events | None | Event listing (filtered) |

🎮 9. Secondary Feature: Live Event Management
Game Planning Mode (/game-planning)
🏆 Real-time animated scoreboards
🎤 Web Speech API voice commands
🤖 ✨ Gemini/Groq AI agent fallback
🎨 React Spring score animations
🎯 Team status management (active/frozen/eliminated)
Command Pattern Matching
const PATTERNS = [
  { pattern: /team (\w+) correct/i, action: 'add_score', delta: 10 },
  { pattern: /start timer (\d+) minutes/i, action: 'timer', state: 'start' },
  { pattern: /eliminate (\w+)/i, action: 'eliminate_team' }
]
🔧 10. Environment Setup
# 🤖 AI Services
GOOGLE_GENERATIVE_AI_API_KEY=    # ✨ Gemini 2.5 Flash
GROQ_API_KEY=                    # Groq fallback (optional)
ELEVENLABS_API_KEY=              # 🔊 ElevenLabs TTS

# 🗄️ Database  
MONGODB_URI=                     # 🔥 MongoDB Atlas

# 🔐 Authentication
NEXT_PUBLIC_FIREBASE_API_KEY=    # Firebase Google Auth
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
✅ 11. Implementation Status
🎯 Fully Implemented
✅ Event Orchestration: Complete AI-powered task management
✅ AI Integration: ✨ Gemini planning, mid-event commands, summaries
✅ Database: 🔥 MongoDB persistence with audit trails
✅ Voice System: Web Speech API + 🔊 ElevenLabs TTS
✅ UI/UX: Comprehensive glassy effects with animations
✅ Auth: Firebase Google sign-in with role-based access
✅ Live Events: Basic quiz mode with voice commands
❌ Not Implemented (Removed Claims)
❌ SpacetimeDB: Uses 🔥 MongoDB with polling instead
❌ Real-time <300ms: Uses ~5 second polling intervals
❌ iron-session: Uses localStorage for session management
❌ Claude Sonnet 4: Uses ✨ Gemini 2.5 Flash throughout
🚀 Ready to Launch
Elixa delivers a complete event orchestration solution that transforms chaotic WhatsApp coordination into structured, AI-powered task management. The core value proposition is fully realized with room for future enhancements.

Primary Use Cases: ✅ Event Orchestration - Complete and production-ready
 🔄 Live Event Management - Basic functionality implemented

Built with ❤️ for HackByte 4.0 | PDPM IIITDM Jabalpur