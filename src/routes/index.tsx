import { createFileRoute } from "@tanstack/react-router";
import { NotesApp } from "@/components/notes-app";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <NotesApp />;
}
