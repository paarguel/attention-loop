import type { SessionState } from "./types";

const STORAGE_KEY = "session-deck.current";

export const emptySession: SessionState = {
  mission: "",
  capture: "",
  tasks: [],
};

export function loadSession(): SessionState {
  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    return emptySession;
  }

  try {
    const parsed = JSON.parse(stored) as SessionState;
    return {
      mission: parsed.mission ?? "",
      capture: parsed.capture ?? "",
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
    };
  } catch {
    return emptySession;
  }
}

export function saveSession(session: SessionState) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession() {
  window.localStorage.removeItem(STORAGE_KEY);
}
