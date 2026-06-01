# AttentionLoop Product Brief

## Intent

AttentionLoop helps one human manage the scarce part of AI-assisted work: attention.

The app is not meant to become a giant task system. It is a small control surface for live work: what you are focused on, what an agent is doing, what is waiting on someone else, and what can safely stay parked.

## Product Sentence

AttentionLoop is an always-on-top attention queue for focused human work alongside parallel AI agents.

## Core Questions

- What owns my attention right now?
- What is running without me?
- What is waiting on a person, tool, or decision?
- What brainstorming thread should not be lost?
- What can be parked without becoming a guilt pile?

## Model

Each thread has:

- Task title
- Project
- Status
- Where
- Waiting on
- Notes

Status determines the lane:

- `now`: Focus
- `running` or `done`: Agents
- `later` with browser or brainstorming context: Brainstorming
- `waiting`: Waiting
- other `later`: Triage Shelf

## Principles

- Capture must be one line.
- The human focus lane must stay singular.
- Editing should happen inline, not in a separate task database.
- Useful defaults should be easy to override.
- Local data should stay local and out of git.
