import { useEffect, useMemo, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import * as Dialog from "@radix-ui/react-dialog";
import { Keyboard, PanelLeft, Plus, Search, Trash2, X } from "lucide-react";
import { MarkdownView } from "@/components/markdown-view";
import {
  bootNotes,
  editedLabel,
  filterNotes,
  noteSnippet,
  noteTitle,
  useNotes,
  wordCount,
  wordsLabel,
  type Note,
} from "@/lib/notes";

function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

function useNow(interval = 30_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), interval);
    return () => window.clearInterval(id);
  }, [interval]);
  return now;
}

function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeReg(needle)})`, "ig"));
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <mark key={`${part}-${index}`}>{part}</mark> : part,
      )}
    </>
  );
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement;
}

export function NotesApp() {
  const hydrated = useNotes((state) => state.hydrated);
  const notes = useNotes((state) => state.notes);
  const selectedId = useNotes((state) => state.selectedId);
  const preview = useNotes((state) => state.preview);
  const setPreview = useNotes((state) => state.setPreview);
  const togglePreview = useNotes((state) => state.togglePreview);
  const select = useNotes((state) => state.select);
  const createNote = useNotes((state) => state.createNote);
  const updateBody = useNotes((state) => state.updateBody);
  const deleteNote = useNotes((state) => state.deleteNote);

  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [mod, setMod] = useState("Ctrl");
  const isMobile = useMedia("(max-width: 767px)");
  const now = useNow();

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const readRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef({
    query,
    listOpen,
    isMobile,
    helpOpen,
    deleteOpen,
  });
  uiRef.current = { query, listOpen, isMobile, helpOpen, deleteOpen };

  useEffect(() => {
    void bootNotes();
  }, []);

  useEffect(() => {
    if (/Mac|iPhone|iPad|iPod/.test(navigator.userAgent)) setMod("⌘");
  }, []);

  const filtered = useMemo(() => filterNotes(notes, query), [notes, query]);
  const selected = notes.find((note) => note.id === selectedId) ?? null;
  const title = selected ? noteTitle(selected.body) : "Vellum";

  useEffect(() => {
    if (!hydrated || !selectedId) return;
    document.getElementById(`note-${selectedId}`)?.scrollIntoView({ block: "nearest" });
  }, [hydrated, selectedId]);

  useEffect(() => {
    if (editorRef.current) editorRef.current.scrollTop = 0;
    readRef.current?.scrollTo(0, 0);
  }, [selectedId]);

  useEffect(() => {
    if (!hydrated) return;
    if (window.matchMedia("(pointer: fine)").matches) editorRef.current?.focus();
  }, [hydrated]);

  const focusEditor = () => {
    window.setTimeout(() => {
      const field = editorRef.current;
      if (!field) return;
      field.focus();
      const end = field.value.length;
      field.setSelectionRange(end, end);
    }, 0);
  };

  const onCreate = () => {
    createNote();
    setQuery("");
    setListOpen(false);
    focusEditor();
  };

  const move = (delta: number) => {
    const list = filterNotes(useNotes.getState().notes, uiRef.current.query);
    if (list.length === 0) return;
    const current = useNotes.getState().selectedId;
    const index = list.findIndex((note) => note.id === current);
    const nextIndex =
      index === -1
        ? delta > 0
          ? 0
          : list.length - 1
        : (index + delta + list.length) % list.length;
    const next = list[nextIndex];
    if (!next) return;
    select(next.id);
    if (document.activeElement instanceof HTMLElement && document.activeElement.classList.contains("note-btn")) {
      requestAnimationFrame(() => document.getElementById(`note-${next.id}`)?.focus());
    }
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const ui = uiRef.current;
      if (!useNotes.getState().hydrated || ui.helpOpen || ui.deleteOpen) return;
      const meta = event.metaKey || event.ctrlKey;
      const typing = isEditable(event.target);
      const inEditor = event.target instanceof HTMLTextAreaElement;

      if (meta && event.key.toLowerCase() === "n" && !event.repeat) {
        event.preventDefault();
        onCreate();
        return;
      }
      if (meta && event.key.toLowerCase() === "k" && !event.repeat) {
        event.preventDefault();
        setListOpen(true);
        requestAnimationFrame(() => {
          searchRef.current?.focus();
          searchRef.current?.select();
        });
        return;
      }
      if (meta && event.code === "Backslash" && !event.repeat) {
        event.preventDefault();
        if (useNotes.getState().selectedId) togglePreview();
        return;
      }
      if (meta && event.key.toLowerCase() === "s") {
        event.preventDefault();
        return;
      }
      if (meta && event.shiftKey && event.key === "Backspace" && !event.repeat) {
        event.preventDefault();
        if (useNotes.getState().selectedId) setDeleteOpen(true);
        return;
      }
      if ((meta && event.key === "/") || (!typing && !meta && event.key === "?")) {
        if (event.repeat) return;
        event.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (event.key === "Escape") {
        if (ui.isMobile && ui.listOpen) {
          setListOpen(false);
          return;
        }
        if (event.target === searchRef.current && ui.query) {
          event.preventDefault();
          setQuery("");
          return;
        }
        if (event.target === searchRef.current || event.target === editorRef.current) {
          (event.target as HTMLElement).blur();
        }
        return;
      }
      if (event.altKey && !meta && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (!inEditor && !meta && !event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        move(event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      if (!typing && event.key === "Home") {
        event.preventDefault();
        const list = filterNotes(useNotes.getState().notes, ui.query);
        const first = list[0];
        if (first) select(first.id);
        return;
      }
      if (!typing && event.key === "End") {
        event.preventDefault();
        const list = filterNotes(useNotes.getState().notes, ui.query);
        const last = list[list.length - 1];
        if (last) select(last.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const countLabel = query.trim()
    ? filtered.length === 1
      ? "1 match"
      : `${filtered.length} matches`
    : notes.length === 1
      ? "1 note"
      : `${notes.length} notes`;

  const edited = selected && now ? editedLabel(selected.updatedAt, now) : null;

  return (
    <div className="vellum">
      {selected ? (
        <a className="skip" href="#note-editor">
          Skip to editor
        </a>
      ) : null}
      <button
        type="button"
        className="backdrop"
        data-open={listOpen ? "true" : "false"}
        aria-label="Close notes"
        tabIndex={listOpen ? 0 : -1}
        onClick={() => setListOpen(false)}
      />
      <aside
        className="sidebar"
        data-open={listOpen ? "true" : "false"}
        aria-label="Notes"
        inert={isMobile && !listOpen ? true : undefined}
      >
        <div className="sidebar-head">
          <p className="wordmark">Vellum</p>
          <button
            type="button"
            id="new-note"
            className="icon-btn primary press"
            aria-label="New note"
            title={`New note (${mod}+N)`}
            aria-keyshortcuts="Control+N"
            disabled={!hydrated}
            onClick={onCreate}
          >
            <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
        <div className="search-wrap">
          <div className="search">
            <Search size={18} strokeWidth={1.75} aria-hidden="true" />
            <input
              ref={searchRef}
              id="note-search"
              type="search"
              placeholder="Search notes"
              aria-label="Search notes"
              aria-controls="note-list"
              aria-keyshortcuts="Control+K"
              value={query}
              disabled={!hydrated}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <button
                type="button"
                className="icon-btn press"
                aria-label="Clear search"
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
              >
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="note-scroll">
          {hydrated ? (
            <>
              <p className="count" aria-live="polite">
                {countLabel}
              </p>
              {filtered.length === 0 ? (
                <div className="empty-list">
                  <p>{query.trim() ? "No matches" : "No notes"}</p>
                  <p>
                    {query.trim()
                      ? `Nothing contains “${query.trim()}”.`
                      : "Create a note to begin."}
                  </p>
                </div>
              ) : (
                <ul className="note-list" id="note-list">
                  {filtered.map((note, index) => (
                    <NoteRow
                      key={note.id}
                      note={note}
                      query={query}
                      selected={note.id === selectedId}
                      tabIndex={note.id === selectedId || (!selectedId && index === 0) ? 0 : -1}
                      edited={now ? editedLabel(note.updatedAt, now) : ""}
                      onSelect={() => {
                        select(note.id);
                        setListOpen(false);
                      }}
                      onOpen={() => {
                        select(note.id);
                        setListOpen(false);
                        focusEditor();
                      }}
                    />
                  ))}
                </ul>
              )}
            </>
          ) : (
            <div aria-hidden="true">
              <div className="skeleton" />
              <div className="skeleton" />
              <div className="skeleton" />
            </div>
          )}
        </div>
        <footer className="rail-foot">
          <button
            type="button"
            className="text-btn press"
            onClick={() => setHelpOpen(true)}
          >
            <Keyboard size={18} strokeWidth={1.75} aria-hidden="true" />
            Shortcuts
          </button>
        </footer>
      </aside>

      <section className="sheet" aria-label="Editor" inert={isMobile && listOpen ? true : undefined}>
        <header className="toolbar">
          <div className="toolbar-start">
            <button
              type="button"
              className="icon-btn press mobile-only"
              aria-label="Open notes"
              onClick={() => setListOpen(true)}
            >
              <PanelLeft size={20} strokeWidth={1.75} aria-hidden="true" />
            </button>
            <p className="toolbar-title mobile-only">{title}</p>
            <p className="toolbar-meta desktop-only">
              {edited ? (edited === "Just now" ? "Edited just now" : `Edited ${edited}`) : "Notes"}
            </p>
          </div>
          <div className="toolbar-end">
            <div
              className="segment"
              role="radiogroup"
              aria-label="View"
              data-preview={preview ? "true" : "false"}
            >
              <span className="segment-thumb" aria-hidden="true" />
              <button
                type="button"
                role="radio"
                id="view-write"
                aria-checked={!preview}
                disabled={!selected}
                onClick={() => setPreview(false)}
              >
                Write
              </button>
              <button
                type="button"
                role="radio"
                id="view-preview"
                aria-checked={preview}
                aria-keyshortcuts="Control+\\"
                disabled={!selected}
                onClick={() => setPreview(true)}
              >
                Preview
              </button>
            </div>
            <button
              type="button"
              id="delete-note"
              className="icon-btn press"
              aria-label="Delete note"
              title={`Delete note (${mod}+Shift+Backspace)`}
              aria-keyshortcuts="Control+Shift+Backspace"
              disabled={!selected}
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </div>
        </header>

        {!hydrated ? (
          <div className="opening" role="status">
            <p>Opening your desk…</p>
          </div>
        ) : selected ? (
          <div className="canvas" data-preview={preview ? "true" : "false"}>
            <div
              className="write"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget) editorRef.current?.focus();
              }}
            >
              <textarea
                ref={editorRef}
                id="note-editor"
                className="write-area"
                value={selected.body}
                placeholder="Start with a title…"
                aria-label={`${title}, markdown`}
                spellCheck
                autoCapitalize="sentences"
                onChange={(event) => updateBody(selected.id, event.target.value)}
              />
            </div>
            {preview ? (
              <div className="read" ref={readRef}>
                <article aria-label="Preview">
                  <MarkdownView key={selected.id} body={selected.body} />
                </article>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="empty-sheet">
            <h1 className="empty-title">No notes</h1>
            <p className="empty-copy">Start one. It stays on this device.</p>
            <button type="button" className="btn btn-primary press" onClick={onCreate}>
              New note
            </button>
          </div>
        )}

        <footer className="status">
          <span className="tabular">{selected ? wordsLabel(wordCount(selected.body)) : "0 words"}</span>
          {edited ? <span className="mobile-only">{edited}</span> : null}
          <span className="status-spacer" />
          <span>On this device</span>
        </footer>
      </section>

      <AlertDialog.Root open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="dialog-overlay" />
          <AlertDialog.Content
            className="dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (useNotes.getState().selectedId) editorRef.current?.focus();
              else document.getElementById("new-note")?.focus();
            }}
          >
            <AlertDialog.Title className="dialog-title">Delete note</AlertDialog.Title>
            <AlertDialog.Description className="dialog-copy">
              “{title}” will be removed from this device. This cannot be undone.
            </AlertDialog.Description>
            <div className="dialog-actions">
              <AlertDialog.Cancel className="btn btn-ghost press">Cancel</AlertDialog.Cancel>
              <AlertDialog.Action
                className="btn btn-primary press"
                onClick={() => {
                  const id = useNotes.getState().selectedId;
                  if (id) deleteNote(id);
                }}
              >
                Delete
              </AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>

      <Dialog.Root open={helpOpen} onOpenChange={setHelpOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="dialog">
            <div className="dialog-head">
              <Dialog.Title className="dialog-title">Shortcuts</Dialog.Title>
              <Dialog.Close className="icon-btn press" aria-label="Close shortcuts">
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </Dialog.Close>
            </div>
            <Dialog.Description className="dialog-copy">
              Keyboard works from the list, search, or while you write.
            </Dialog.Description>
            <ul className="shortcut-list">
              <Shortcut name="New note" keys={[mod, "N"]} />
              <Shortcut name="Search" keys={[mod, "K"]} />
              <Shortcut name="Toggle preview" keys={[mod, "\\"]} />
              <Shortcut name="Next note" keys={["Alt", "↓"]} />
              <Shortcut name="Previous note" keys={["Alt", "↑"]} />
              <Shortcut name="Delete note" keys={[mod, "Shift", "⌫"]} />
              <Shortcut name="Shortcuts" keys={["?"]} />
            </ul>
            <p className="dialog-note">
              Arrow keys move through the list unless the cursor is in the note. Escape clears
              search.
            </p>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}

function Shortcut({ name, keys }: { name: string; keys: string[] }) {
  return (
    <li>
      <span>{name}</span>
      <span className="shortcut-keys">
        {keys.map((key) => (
          <kbd key={key}>{key}</kbd>
        ))}
      </span>
    </li>
  );
}

function NoteRow({
  note,
  query,
  selected,
  tabIndex,
  edited,
  onSelect,
  onOpen,
}: {
  note: Note;
  query: string;
  selected: boolean;
  tabIndex: number;
  edited: string;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const title = noteTitle(note.body);
  const snippet = noteSnippet(note.body, query);
  return (
    <li>
      <button
        type="button"
        id={`note-${note.id}`}
        className="note-btn press"
        aria-current={selected ? "true" : undefined}
        tabIndex={tabIndex}
        title={title.length > 42 ? title : undefined}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === "Enter") onOpen();
        }}
      >
        <span className="note-title">
          <Highlight text={title} query={query} />
        </span>
        {snippet ? (
          <span className="note-snippet">
            <Highlight text={snippet} query={query} />
          </span>
        ) : null}
        {edited ? <span className="note-time">{edited}</span> : null}
      </button>
    </li>
  );
}
