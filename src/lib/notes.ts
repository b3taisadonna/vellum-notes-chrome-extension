import { formatDistanceToNow } from "date-fns";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Note = {
  id: string;
  body: string;
  createdAt: number;
  updatedAt: number;
};

type NotesState = {
  notes: Note[];
  selectedId: string | null;
  preview: boolean;
  seeded: boolean;
  hydrated: boolean;
  setPreview: (value: boolean) => void;
  togglePreview: () => void;
  select: (id: string) => void;
  createNote: () => string;
  updateBody: (id: string, body: string) => void;
  deleteNote: (id: string) => void;
};

const WELCOME = [
  "# Welcome to Vellum",
  "",
  "Notes stay in this browser. The first line becomes the title.",
  "",
  "Write in Markdown, then switch to Preview to read it back.",
  "",
  "- New note — Ctrl/⌘ N",
  "- Search — Ctrl/⌘ K",
  "- Preview — Ctrl/⌘ \\",
  "- Next or previous — Alt and the arrow keys",
  "- Delete — Ctrl/⌘ Shift Backspace",
  "- All shortcuts — ?",
  "",
  "> Keep the sentence you are in.",
].join("\n");

const CHEAT = [
  "# A few marks",
  "",
  "Markdown is plain text with a light structure.",
  "",
  "## A list",
  "",
  "- [x] Open the desk",
  "- [ ] Write the next sentence",
  "- Leave the rest for later",
  "",
  "## Emphasis",
  "",
  "A *quiet* word, a **firmer** one, and `inline code` for names.",
  "",
  "A [link](https://en.wikipedia.org/wiki/Markdown) stays a link.",
  "",
  "## Quoted",
  "",
  "> The desk is clear. Begin.",
  "",
  "## A block",
  "",
  "```",
  "left = right + padding",
  "```",
].join("\n");

const MARKET = [
  "# Saturday market",
  "",
  "Eggs, rye, and a bunch of thyme if it looks decent.",
  "",
  "The stall by the gate had late peaches last week. Ask about the honey — the darker jar, not the clover.",
  "",
  "Back by four.",
].join("\n");

function uid(): string {
  return crypto.randomUUID();
}

export function makeSeed(now = Date.now()): Note[] {
  return [
    {
      id: uid(),
      body: WELCOME,
      createdAt: now - 60_000,
      updatedAt: now - 60_000,
    },
    {
      id: uid(),
      body: CHEAT,
      createdAt: now - 86_400_000,
      updatedAt: now - 5 * 3_600_000,
    },
    {
      id: uid(),
      body: MARKET,
      createdAt: now - 3 * 86_400_000,
      updatedAt: now - 26 * 3_600_000,
    },
  ];
}

export function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const note = value as Record<string, unknown>;
  return (
    typeof note.id === "string" &&
    typeof note.body === "string" &&
    typeof note.createdAt === "number" &&
    typeof note.updatedAt === "number"
  );
}

export function noteTitle(body: string): string {
  const line = body
    .split("\n")
    .map((entry) => entry.trim())
    .find(Boolean);
  if (!line) return "Untitled";
  const stripped = line
    .replace(/^#{1,6}\s+/, "")
    .replace(/^[-*]\s+(\[[ xX]\]\s+)?/, "")
    .replace(/[*_`]/g, "")
    .trim();
  return stripped || "Untitled";
}

export function noteSnippet(body: string, query = ""): string {
  const lines = body
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
  const clean = (line: string) =>
    line
      .replace(/^#{1,6}\s+/, "")
      .replace(/^[-*]\s+(\[[ xX]\]\s+)?/, "")
      .replace(/[*_`>#]/g, "")
      .replace(/\[(.*?)\]\(.*?\)/g, "$1")
      .trim();
  const q = query.trim().toLowerCase();
  if (q) {
    const hit = lines.find((line) => line.toLowerCase().includes(q));
    if (hit) return clean(hit).slice(0, 96);
  }
  const rest = lines.slice(1).map(clean).find(Boolean);
  return rest ? rest.slice(0, 96) : "";
}

export function wordCount(body: string): number {
  const words = body.trim().match(/\S+/g);
  return words?.length ?? 0;
}

export function wordsLabel(count: number): string {
  return count === 1 ? "1 word" : `${count} words`;
}

export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => b.updatedAt - a.updatedAt || b.createdAt - a.createdAt);
}

export function filterNotes(notes: Note[], query: string): Note[] {
  const sorted = sortNotes(notes);
  const q = query.trim().toLowerCase();
  if (!q) return sorted;
  return sorted.filter((note) => {
    const hay = `${noteTitle(note.body)}\n${note.body}`.toLowerCase();
    return hay.includes(q);
  });
}

export function editedLabel(ts: number, now: number): string {
  if (now - ts < 45_000) return "Just now";
  return formatDistanceToNow(ts, { addSuffix: true });
}

function createMemoryStorage() {
  const memory = new Map<string, string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { name: string; value: string } | null = null;

  const local = () => (typeof window === "undefined" ? null : window.localStorage);

  const flush = () => {
    if (!pending) return;
    local()?.setItem(pending.name, pending.value);
    pending = null;
  };

  if (typeof window !== "undefined") {
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return {
    getItem: (name: string) => {
      if (pending?.name === name) return pending.value;
      return local()?.getItem(name) ?? memory.get(name) ?? null;
    },
    setItem: (name: string, value: string) => {
      const store = local();
      if (!store) {
        memory.set(name, value);
        return;
      }
      pending = { name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, 120);
    },
    removeItem: (name: string) => {
      if (pending?.name === name) pending = null;
      memory.delete(name);
      local()?.removeItem(name);
    },
  };
}

export const useNotes = create<NotesState>()(
  persist(
    (set, get) => ({
      notes: [],
      selectedId: null,
      preview: false,
      seeded: false,
      hydrated: false,
      setPreview: (value) => set({ preview: value }),
      togglePreview: () => set((state) => ({ preview: !state.preview })),
      select: (id) => set({ selectedId: id }),
      createNote: () => {
        const state = get();
        const current = state.notes.find((note) => note.id === state.selectedId);
        if (current && current.body.trim() === "") return current.id;
        const now = Date.now();
        const note: Note = { id: uid(), body: "", createdAt: now, updatedAt: now };
        set({ notes: [note, ...state.notes], selectedId: note.id });
        return note.id;
      },
      updateBody: (id, body) =>
        set((state) => ({
          notes: state.notes.map((note) =>
            note.id === id ? { ...note, body, updatedAt: Date.now() } : note,
          ),
        })),
      deleteNote: (id) =>
        set((state) => {
          const notes = state.notes.filter((note) => note.id !== id);
          let selectedId = state.selectedId;
          if (state.selectedId === id) {
            selectedId = sortNotes(notes)[0]?.id ?? null;
          }
          return { notes, selectedId };
        }),
    }),
    {
      name: "vellum.notes.v1",
      storage: createJSONStorage(createMemoryStorage),
      skipHydration: true,
      partialize: (state) => ({
        notes: state.notes,
        selectedId: state.selectedId,
        preview: state.preview,
        seeded: state.seeded,
      }),
    },
  ),
);

let boot: Promise<void> | null = null;

export function bootNotes(): Promise<void> {
  if (!boot) {
    boot = (async () => {
      await useNotes.persist.rehydrate();
      const state = useNotes.getState();
      const notes = Array.isArray(state.notes) ? state.notes.filter(isNote) : [];
      if (!state.seeded) {
        const seeded = makeSeed();
        useNotes.setState({
          notes: seeded,
          selectedId: seeded[0]?.id ?? null,
          seeded: true,
          hydrated: true,
        });
        return;
      }
      const selectedStillThere = notes.some((note) => note.id === state.selectedId);
      useNotes.setState({
        notes,
        selectedId: selectedStillThere ? state.selectedId : (sortNotes(notes)[0]?.id ?? null),
        hydrated: true,
      });
    })();
  }
  return boot;
}
