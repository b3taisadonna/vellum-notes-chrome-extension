const KEY = "vellum-extension-notes";
let notes = JSON.parse(localStorage.getItem(KEY) || "[]");
if (!Array.isArray(notes)) notes = [];
let selectedId = notes[0]?.id || null;
let query = "";
let previewing = false;
const $ = (id) => document.getElementById(id);
const editor = $("editor");

function save() { localStorage.setItem(KEY, JSON.stringify(notes)); }
function selected() { return notes.find((note) => note.id === selectedId) || null; }
function title(body) { return (body.split("\n").find((line) => line.trim()) || "Untitled note").replace(/^#+\s*/, "").slice(0, 80); }
function words(body) { return body.trim() ? body.trim().split(/\s+/).length : 0; }
function markdown(body) {
  return body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/^### (.*)$/gm,"<h3>$1</h3>").replace(/^## (.*)$/gm,"<h2>$1</h2>").replace(/^# (.*)$/gm,"<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/`([^`]+)`/g,"<code>$1</code>")
    .split(/\n\s*\n/).map((part)=>part.startsWith("<h")?part:`<p>${part.replace(/\n/g,"<br>")}</p>`).join("");
}
function render() {
  const current = selected();
  const filtered = notes.filter((note) => `${title(note.body)} ${note.body}`.toLowerCase().includes(query.toLowerCase()));
  $("count").textContent = `${filtered.length} ${filtered.length === 1 ? "note" : "notes"}`;
  $("note-list").innerHTML = filtered.map((note) => `<button class="note-btn ${note.id===selectedId?"selected":""}" data-id="${note.id}"><span class="note-title">${escapeHtml(title(note.body))}</span><span class="note-snippet">${escapeHtml(note.body.replace(/\s+/g," ").slice(0,70))}</span></button>`).join("") || `<p class="count">No matching notes</p>`;
  document.querySelectorAll(".note-btn").forEach((button) => button.addEventListener("click", () => { selectedId=button.dataset.id; previewing=false; render(); }));
  editor.value = current?.body || "";
  editor.readOnly = false;
  $("delete").disabled = !current;
  $("empty").hidden = !!current;
  $("edited").textContent = current ? "Editing on this device" : "No note selected";
  $("words").textContent = `${words(current?.body || "")} words`;
  $("read").innerHTML = current ? markdown(current.body) : "";
  $("read").hidden = !current || !previewing;
  editor.hidden = !current || previewing;
  $("write").classList.toggle("active", !previewing); $("preview").classList.toggle("active", previewing);
}
function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[char])); }
function focusEditor() { requestAnimationFrame(() => { editor.focus(); editor.setSelectionRange(editor.value.length, editor.value.length); }); }
function createNote() { const note={id:crypto.randomUUID(),body:"# New note\n\n"}; notes=[note,...notes]; selectedId=note.id; save(); render(); focusEditor(); }
$("new-note").addEventListener("click", createNote);
editor.addEventListener("input", () => { const note=selected(); if(!note)return; note.body=editor.value; save(); render(); focusEditor(); });
editor.addEventListener("paste", (event) => {
  const note = selected();
  const text = event.clipboardData?.getData("text/plain");
  if (!note || text == null) return;
  event.preventDefault();
  editor.setRangeText(text, editor.selectionStart, editor.selectionEnd, "end");
  note.body = editor.value;
  save();
  render();
  focusEditor();
});
$("search").addEventListener("input", (event) => { query=event.target.value; render(); });
$("delete").addEventListener("click", () => { if(!selected() || !confirm("Delete this note?"))return; notes=notes.filter((note)=>note.id!==selectedId); selectedId=notes[0]?.id||null; save(); render(); });
$("write").addEventListener("click", () => { previewing=false; render(); }); $("preview").addEventListener("click", () => { previewing=true; render(); });
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "n") {
    event.preventDefault();
    createNote();
  }
});
if (!selectedId) createNote();
render();
