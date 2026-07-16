"use client";

import { useEffect, useRef, useState } from "react";
import { bookAppointment } from "@/app/actions/booking";

type Message = { id: string; role: "USER" | "ASSISTANT"; content: string; createdAt: string };
type Status = "IN_PROGRESS" | "PASSED" | "FAILED";
type Slot = { id: string; startTime: string; endTime: string };

export function ChatClient({
  sessionId,
  propertyId,
  initialMessages,
  initialStatus,
  initialFailReasons,
}: {
  sessionId: string;
  propertyId: string;
  initialMessages: Message[];
  initialStatus: Status;
  initialFailReasons: string[];
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [failReasons, setFailReasons] = useState(initialFailReasons);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (status !== "PASSED") return;
    fetch(`/api/properties/${propertyId}/slots`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots))
      .catch(() => setSlots([]));
  }, [status, propertyId]);

  async function send() {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    setInput("");
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "USER", content, createdAt: new Date().toISOString() },
    ]);

    try {
      const res = await fetch(`/api/screening/${sessionId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setMessages(data.messages);
      setStatus(data.status);
      setFailReasons(data.failReasons ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
              m.role === "ASSISTANT"
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-900 dark:text-zinc-100"
                : "ml-auto bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            }`}
          >
            {m.content}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {status === "IN_PROGRESS" && (
        <div className="mt-4 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send();
            }}
            placeholder="Type your answer…"
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            onClick={send}
            disabled={sending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {sending ? "…" : "Send"}
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {status === "FAILED" && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <p className="font-medium">This property&apos;s criteria weren&apos;t met:</p>
          <ul className="mt-1 list-inside list-disc">
            {failReasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      )}

      {status === "PASSED" && (
        <div className="mt-4 rounded-md border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            You&apos;re ready to book a showing. Pick a time:
          </p>
          {!slots ? (
            <p className="mt-2 text-sm text-green-700 dark:text-green-300">
              Loading available times…
            </p>
          ) : slots.length === 0 ? (
            <p className="mt-2 text-sm text-green-700 dark:text-green-300">
              No open times right now — check back soon.
            </p>
          ) : (
            <ul className="mt-2 flex flex-col gap-2">
              {slots.map((s) => (
                <li key={s.id}>
                  <form action={bookAppointment} className="flex items-center justify-between gap-2">
                    <input type="hidden" name="slotId" value={s.id} />
                    <input type="hidden" name="screeningSessionId" value={sessionId} />
                    <span className="text-sm text-green-900 dark:text-green-100">
                      {new Date(s.startTime).toLocaleString()}
                    </span>
                    <button
                      type="submit"
                      className="rounded-md bg-green-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-800"
                    >
                      Book
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
