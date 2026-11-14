import type { Metadata } from "next";
import { ChatPanel } from "@/components/chat/chat-panel";
import { getSessionUser } from "@/lib/server/session";

export const metadata: Metadata = { title: "Ask Clubo" };

export default async function ChatPage({ searchParams }: PageProps<"/chat">) {
  const [user, sp] = await Promise.all([getSessionUser(), searchParams]);
  const q = typeof sp.q === "string" ? sp.q.slice(0, 500) : undefined;
  return <ChatPanel signedIn={!!user} initialQuestion={q} />;
}
