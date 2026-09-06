# Prompt for Claude Code: Sprint Retrospective App

Copy everything below into Claude Code to kick off the build.

---

Build a web app for running sprint retrospectives, similar to EasyRetro. Keep it simple, clean, and fast — no unnecessary complexity. Use React (Vite) for the frontend, a lightweight Node/Express backend, and SQLite for storage (easy to swap for Postgres later). Use WebSockets (socket.io) for real-time sync between participants.

## Core Concept

A "board" represents one retrospective session. A facilitator creates a board, shares a link/code, and teammates join to add sticky notes, vote, and group ideas — all updating live for everyone on the board.

## Must-Have Features

### 1. Board creation & joining
- Create a board by choosing a template and giving it a name.
- Each board gets a unique shareable URL/code (no login required to join).
- Optional: creator can set a password/PIN for the board.

### 2. Templates (pick at least these 3 to start)
- **Went Well / Went Wrong / Action Items**
- **Start / Stop / Continue**
- **Mad / Sad / Glad**
Each template just defines the columns shown on the board.

### 3. Sticky notes (cards)
- Any participant can add a card to a column.
- Edit/delete only your own cards (unless you're the facilitator).
- Cards support basic text, character limit (~280 chars), and can be dragged between columns.

### 4. Anonymous mode
- Toggle at board creation: names shown vs. fully anonymous authorship.
- Even in named mode, show a color/avatar per participant, not just plain text.

### 5. Voting
- Dot-voting: each participant gets a limited number of votes (default 5, configurable by facilitator).
- Votes are cast on cards; show vote count per card.
- Facilitator can lock voting and reveal results, or keep it live.

### 6. Grouping
- Drag one card onto another to merge them into a group (common EasyRetro pattern).
- Grouped cards show combined vote totals.

### 7. Action items
- A dedicated column/section for action items.
- Each action item can have an assignee (free-text name) and a status (todo/done).

### 8. Facilitator controls
- Start/stop a timer for the session (visible to all participants).
- Move the board through phases: **Add cards → Group & vote → Discuss → Done**.
- Ability to lock adding new cards once discussion starts.

### 9. Export
- Export the finished board as Markdown or CSV (columns, cards, votes, action items).

### 10. Real-time sync
- All participants see cards, votes, and moves update live without refreshing.

## Nice-to-Have (only after the above works)
- Board history (list of past retros for a team).
- Reactions/emojis on cards instead of just votes.
- Custom templates (user-defined columns).
- Dark mode.

## Data Model (suggested starting point)
- `Board`: id, name, template, created_at, settings (anonymous, max_votes, locked)
- `Column`: id, board_id, title, order
- `Card`: id, column_id, author_name (nullable), text, group_id (nullable), created_at
- `Vote`: id, card_id, participant_id
- `ActionItem`: id, board_id, text, assignee, status
- `Participant`: id, board_id, display_name, color

## UI/UX Guidelines
- Minimal, uncluttered layout — columns side by side, cards as simple rounded rectangles.
- Clear visual distinction between phases (e.g., a progress bar or step indicator at the top).
- Mobile-responsive: participants often join from phones during meetings.
- Fast to join: landing on a board via link should take someone straight into it, name prompt only if not anonymous.

## Build Order (suggested)
1. Scaffold project (Vite + React frontend, Express + Socket.io backend, SQLite via better-sqlite3 or Prisma).
2. Board creation + template selection + join flow.
3. Card CRUD within columns, without real-time yet.
4. Add Socket.io for live sync across clients.
5. Voting system.
6. Grouping/merging cards.
7. Facilitator controls (timer, phase lock, reveal votes).
8. Action items section.
9. Export functionality.
10. Polish UI/responsiveness.

Please scaffold the project structure first, confirm the plan with me, then implement incrementally, testing each feature (e.g., open two browser tabs to confirm real-time sync) before moving to the next.
