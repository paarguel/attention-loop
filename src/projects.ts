export type ProjectStyle = {
  name: string;
  aliases: string[];
};

/** Starter projects. Users grow this list implicitly by capturing or editing. */
export const projectCatalog: ProjectStyle[] = [
  { name: "Inbox", aliases: ["inbox", "triage", "unclear"] },
  { name: "Work", aliases: ["work", "project", "client", "team"] },
  { name: "Personal", aliases: ["personal", "home", "life"] },
  { name: "Career", aliases: ["career", "job", "jobs", "resume", "application", "recruiter"] },
  { name: "Research", aliases: ["research", "read", "reading", "notes"] },
  { name: "Writing", aliases: ["writing", "draft", "blog", "essay", "docs"] },
  { name: "Learning", aliases: ["learning", "course", "study", "practice"] },
  { name: "AttentionLoop", aliases: ["attention loop", "attentionloop", "attention-loop", "app"] },
];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * Resolve a capture prefix to a known project name.
 * Fuzzy: matches on name or alias, in either direction. Unknown prefixes are
 * returned trimmed as-is so capturing a new prefix creates a new project.
 */
export function matchProject(prefix: string, existing: string[] = []): string {
  const key = normalize(prefix);
  if (!key) return "";

  for (const name of existing) {
    if (normalize(name) === key) return name;
  }

  for (const entry of projectCatalog) {
    const candidates = [entry.name, ...entry.aliases].map(normalize);
    if (candidates.some((c) => c === key || c.includes(key) || key.includes(c))) {
      return entry.name;
    }
  }

  return prefix.trim();
}

export function defaultProjects(): string[] {
  return projectCatalog.map((p) => p.name);
}
