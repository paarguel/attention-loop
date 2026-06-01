/// <reference types="vite/client" />

import type { DeckState } from "./types";

declare global {
  interface Window {
    attentionLoopStorage?: {
      load: () => Promise<unknown | null>;
      save: (deck: DeckState) => Promise<boolean>;
      clear: () => Promise<boolean>;
    };
  }
}
