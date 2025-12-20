# GFPD Content Engine - Implementation Task List

## Project Overview
Build the "Go For Powered Descent" Content Engine - a Next.js application that automates aerospace news research, strategic filtering, and technical scriptwriting for a YouTube channel.

**Current State:** Fresh Next.js 16 + React 19 + Tailwind CSS v4 project with 6 system files in `/public/system_files`.

**Configuration Decisions:**
- **LLM Provider:** Anthropic (Claude) - API key already configured in `.env.local`
- **Database:** Skip Supabase for MVP - focus on core generation flow
- **API Keys:** All configured (`PERPLEXITY_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`)

---

## Phase 1: Project Setup & Configuration

### 1.1 Theme & Styling Setup
- [ ] Update `globals.css` with "Engineering Blueprint" color palette:
  - Background: `#0f172a` (Slate 900)
  - Accent: `#f97316` (Orange 500)
  - Borders: `#334155` (Slate 700)
- [ ] Add Roboto Mono font for monospace data displays
- [ ] Configure Inter font for body copy (or keep Geist)
- [ ] Create CSS custom properties for consistent theming

### 1.2 Project Structure
- [ ] Create `/components` directory structure:
  - `/components/ui` - Base UI components
  - `/components/radar` - Research Radar components
  - `/components/packager` - Strategic Packaging components
  - `/components/hook` - Hook Generator components
  - `/components/scribe` - Script Writer components
- [ ] Create `/lib` directory for utilities and API clients
- [ ] Create `/app/api` directory for API routes
- [ ] Create `/types` directory for TypeScript definitions

### 1.3 Dependencies Installation
- [ ] Install Vercel AI SDK (`ai`, `@ai-sdk/anthropic`)
- [ ] Install any additional UI dependencies (if needed)

### 1.4 Environment Configuration
- [x] API keys already configured in `.env.local`:
  - `PERPLEXITY_API_KEY` ✓
  - `ANTHROPIC_API_KEY` ✓
  - `OPENAI_API_KEY` ✓ (backup)
  - `GEMINI_API_KEY` ✓ (backup)

---

## Phase 2: Knowledge Base Integration

### 2.1 System Files Loader
- [ ] Create `/lib/knowledge-base.ts` utility to read system files
- [ ] Implement functions to load each guide file:
  - `loadPackagingGuide()`
  - `loadAestheticGuide()`
  - `loadAudiencePersona()`
  - `loadRetroArchive()`
  - `loadTechnicalFramework()`
  - `loadToneGuide()`
- [ ] Create combined loader functions for specific use cases:
  - `getScriptingContext()` - Tone + Audience + Technical
  - `getPackagingContext()` - Packaging + Aesthetic

### 2.2 System Prompt Builder
- [ ] Create `/lib/prompts.ts` for prompt construction
- [ ] Build Perplexity search prompt template
- [ ] Build Hook Generator prompt template
- [ ] Build Outline (Architect) prompt template
- [ ] Build Script (Scribe) prompt template

---

## Phase 3: API Routes

### 3.1 Perplexity Integration (Research Radar)
- [ ] Create `/app/api/radar/route.ts` - Main radar scan endpoint
- [ ] Implement Perplexity API client (`sonar-medium-online` model)
- [ ] Parse response into 4 Story Cards with:
  - Story Title & Timestamp
  - Suitability Score (1-15)
  - Key Hardware Data
  - Source URLs (7-10)
- [ ] Add 48-hour fallback logic for timeout/empty results

### 3.2 Packaging Module
- [ ] Create `/app/api/package/route.ts` - Story packaging endpoint
- [ ] Generate 3 "Engineering Anchor" titles
- [ ] Generate thumbnail layout suggestions
- [ ] Generate Midjourney prompt for "Industrial Technical" look

### 3.3 Hook Generator
- [ ] Create `/app/api/hook/route.ts` - Hook generation endpoint
- [ ] Generate 3 variations (Hardware, Geopolitical, Heritage)
- [ ] Implement winner selection logic

### 3.4 Script Generator (Modular)
- [ ] Create `/app/api/outline/route.ts` - Outline generation endpoint
- [ ] Create `/app/api/script/route.ts` - Batch script generation
- [ ] Implement streaming responses with Vercel AI SDK
- [ ] Add word count tracking
- [ ] Implement "Expand Technical Data" re-prompt for short segments
- [ ] Add banned phrase detection (flag for re-roll)

---

## Phase 4: UI Components

### 4.1 Layout & Navigation
- [ ] Update `/app/layout.tsx` with mission control styling
- [ ] Create main dashboard layout component
- [ ] Add navigation between workflow phases
- [ ] Implement "Terminal Window" aesthetic container

### 4.2 Research Radar Dashboard
- [ ] Create `RadarDashboard` component
- [ ] Implement "Initiate Radar Scan" button
- [ ] Create `StoryCard` component with:
  - Title & Timestamp display
  - Suitability Score "Telemetry Gauge"
  - Hardware Data preview
  - Source links list
  - "Greenlight" selection button
- [ ] Add loading states with mission control animations
- [ ] Display 4 story cards in grid layout

### 4.3 Intelligence Briefing View
- [ ] Create `BriefingView` component
- [ ] Display selected story's technical pillars:
  - Hardware Data section
  - Political/Business Context
  - Retro Parallel
  - Reality Check
- [ ] Show all source URLs organized by category

### 4.4 Strategic Packaging Panel
- [ ] Create `PackagingPanel` component
- [ ] Display 3 title options with selection
- [ ] Show thumbnail layout suggestions
- [ ] Display Midjourney prompt with copy button

### 4.5 Hook Generator Panel
- [ ] Create `HookGenerator` component
- [ ] Display 3 hook variations:
  - Hardware Lead
  - Geopolitical Lead
  - Heritage Lead
- [ ] Implement winner selection UI
- [ ] Display "THE CHOSEN FLIGHT BRIEFING"

### 4.6 Modular Script Writer
- [ ] Create `ScriptWriter` component
- [ ] Implement phase-based generation:
  - Hook + Phase 1 (Hardware)
  - Phase 2 (Deep-Dive & Heritage)
  - Phase 3 (Geopolitical Impact)
- [ ] Create streaming "Terminal Window" display
- [ ] Add word count tracker
- [ ] Implement "Copy to Clipboard" button (clean script only)
- [ ] Add Sources section at script end

### 4.7 Reusable UI Components
- [ ] Create `TelemetryGauge` component for scores
- [ ] Create `TerminalWindow` wrapper component
- [ ] Create `ActionButton` with orange accent styling
- [ ] Create `DataCard` for technical data display
- [ ] Create `LoadingState` with mission control animation

---

## Phase 5: State Management & Workflow

### 5.1 Workflow State
- [ ] Implement workflow state management (React Context or Zustand)
- [ ] Track current phase in workflow
- [ ] Store selected story data
- [ ] Store selected title/hook
- [ ] Store generated script segments

### 5.2 Data Flow
- [ ] Implement story selection → packaging trigger
- [ ] Implement hook selection → script anchor
- [ ] Implement phase-by-phase script generation chain

---

## Phase 6: Error Handling & Edge Cases

### 6.1 API Error Handling
- [ ] Implement Perplexity timeout handling with 48-hour fallback
- [ ] Add retry logic for failed API calls
- [ ] Display user-friendly error messages

### 6.2 Content Validation
- [ ] Implement banned phrase detection
- [ ] Add script length validation
- [ ] Implement re-roll functionality for flagged content

---

## Phase 7: Polish & Optimization

### 7.1 UI Polish
- [ ] Add smooth transitions between phases
- [ ] Implement responsive design for different screen sizes
- [ ] Add keyboard shortcuts for common actions

### 7.2 Performance
- [ ] Optimize API calls
- [ ] Implement proper loading states
- [ ] Add error boundaries

---

## MVP Deliverables Checklist

- [ ] **Radar Dashboard:** Perplexity-connected story fetching (4 stories)
- [ ] **Intelligence Briefing View:** Technical pillars display for selected story
- [ ] **Modular Writer:** 3-phase streaming script generation
- [ ] **Copy-to-Clipboard:** Clean script export for TTS

---

## File Structure (Target)

```
/app
  /api
    /radar/route.ts
    /package/route.ts
    /hook/route.ts
    /outline/route.ts
    /script/route.ts
  layout.tsx
  page.tsx
  globals.css
/components
  /ui
    TelemetryGauge.tsx
    TerminalWindow.tsx
    ActionButton.tsx
    DataCard.tsx
    LoadingState.tsx
  /radar
    RadarDashboard.tsx
    StoryCard.tsx
  /packager
    PackagingPanel.tsx
  /hook
    HookGenerator.tsx
  /scribe
    ScriptWriter.tsx
    BriefingView.tsx
/lib
  knowledge-base.ts
  prompts.ts
  perplexity.ts
  ai-client.ts
/types
  index.ts
/public
  /system_files
    (existing 6 .txt files)
```

---

## Notes

- **Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Vercel AI SDK
- **AI Models:** Perplexity (sonar-medium-online), Anthropic Claude 3.5 Sonnet (primary)
- **Design:** "Engineering Blueprint" aesthetic - mission control terminal look
- **Key Constraint:** All content must pass through Knowledge Base filters
- **No Database:** MVP runs without persistence - all state in-memory/client-side
