# AttentionLoop

AttentionLoop is an always-on-top attention queue for focused human work alongside AI agents.

AI tools can run many threads in parallel. Your attention cannot. AttentionLoop gives you one small place to decide what owns your focus, what is running elsewhere, what is waiting, and what is parked for later.

## Features

- One-line capture for loose work threads.
- A single focus lane for the task that owns your attention now.
- Agent, brainstorming, waiting, and triage lanes for everything else.
- Inline editing for task title, project, location, status, waiting reason, and notes.
- Quick-add projects and locations directly from the task editor.
- Always-on-top desktop window for Windows/macOS/Linux through Electron.
- Local-first storage with no hosted backend.
- Desktop file storage in `.attention-loop/deck.json`, ignored by git.
- Browser fallback storage with `localStorage`.

## Quick Start

```bash
npm install
npm run desktop
```

That starts the local Vite app and opens AttentionLoop as a floating desktop window.

Keyboard shortcuts while the desktop app is running:

- `Ctrl+Alt+D`: hide or show the floating window.
- `Ctrl+Alt+F`: bring the floating window back into focus.

## Web Development

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://127.0.0.1:5174/`.

## Build

```bash
npm run build
```

This verifies the TypeScript and Vite production build. The current desktop script is a development wrapper around the local app, not a packaged installer.

To create a pin-friendly Windows desktop app:

```bash
npm run build:desktop
```

The executable is written to:

```text
release/AttentionLoop-win32-x64/AttentionLoop.exe
```

Pin that executable, not `electron.exe`.

## How to Use It

Capture one line:

```text
Work: draft launch notes in Codex
```

AttentionLoop will infer the project, task, lane, and location when it can. You can always edit everything inline.

Suggested flow:

1. Pick one task as Focus.
2. Work it until your human attention is no longer needed.
3. Send it to Agents, Brainstorming, Waiting, or Triage.
4. Choose the next Focus.

## Data and Privacy

AttentionLoop is local-first.

- The browser app stores data in browser `localStorage`.
- The desktop app stores data in `.attention-loop/deck.json` inside the project folder.
- `.attention-loop/` is gitignored so your personal task data is not committed.
- There is no remote database or hosted service.

## Project Structure

```text
desktop/      Electron wrapper for the always-on-top window
docs/         Product notes
src/          React app
```

## License

MIT
