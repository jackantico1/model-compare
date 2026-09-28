"use client";

import { useState, useRef, useEffect } from "react";
import { generateId } from "@/lib/id";
import type {
  ChatMessage,
  CompareResponseBody,
  ModelKey,
  ModelReply,
  Vote,
} from "@/lib/types";

interface Turn {
  id: string;
  prompt: string;
  status: "loading" | "done" | "error";
  left?: ModelReply;
  right?: ModelReply;
  vote?: Vote;
  revealed: boolean;
  error?: string;
}

const MODEL_LABEL: Record<ModelKey, string> = {
  qwen: "Qwen",
  llama: "Llama",
};

export default function Home() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const qwenHistory = useRef<ChatMessage[]>([]);
  const llamaHistory = useRef<ChatMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const prompt = input.trim();
    if (!prompt || busy) return;

    const userMsg: ChatMessage = { role: "user", content: prompt };
    const nextQwenHistory = [...qwenHistory.current, userMsg];
    const nextLlamaHistory = [...llamaHistory.current, userMsg];

    const turnId = generateId();
    setTurns((prev) => [
      ...prev,
      { id: turnId, prompt, status: "loading", revealed: false },
    ]);
    setInput("");
    setBusy(true);

    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qwenMessages: nextQwenHistory,
          llamaMessages: nextLlamaHistory,
        }),
      });

      if (!res.ok) {
        throw new Error(`Request failed: ${res.status}`);
      }

      const data: CompareResponseBody = await res.json();

      if (!data.left.error) {
        nextQwenHistory.push(
          ...(data.left.model === "qwen"
            ? [{ role: "assistant" as const, content: data.left.content }]
            : [])
        );
      }
      if (!data.right.error) {
        nextQwenHistory.push(
          ...(data.right.model === "qwen"
            ? [{ role: "assistant" as const, content: data.right.content }]
            : [])
        );
      }
      if (!data.left.error) {
        nextLlamaHistory.push(
          ...(data.left.model === "llama"
            ? [{ role: "assistant" as const, content: data.left.content }]
            : [])
        );
      }
      if (!data.right.error) {
        nextLlamaHistory.push(
          ...(data.right.model === "llama"
            ? [{ role: "assistant" as const, content: data.right.content }]
            : [])
        );
      }

      qwenHistory.current = nextQwenHistory;
      llamaHistory.current = nextLlamaHistory;

      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? { ...t, status: "done", left: data.left, right: data.right }
            : t
        )
      );
    } catch (err) {
      setTurns((prev) =>
        prev.map((t) =>
          t.id === turnId
            ? {
                ...t,
                status: "error",
                error: err instanceof Error ? err.message : "Unknown error",
              }
            : t
        )
      );
    } finally {
      setBusy(false);
    }
  }

  function castVote(turnId: string, vote: Vote) {
    setTurns((prev) =>
      prev.map((t) => (t.id === turnId ? { ...t, vote, revealed: true } : t))
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Model Arena
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Every prompt is sent to two models running on RunPod. Vote for the
          better answer once both are in.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8">
        {turns.length === 0 && (
          <p className="mt-16 text-center text-zinc-400 dark:text-zinc-600">
            Ask something to start a comparison.
          </p>
        )}

        {turns.map((turn) => (
          <TurnView key={turn.id} turn={turn} onVote={castVote} />
        ))}
        <div ref={bottomRef} />
      </main>

      <form
        onSubmit={handleSubmit}
        className="sticky bottom-0 border-t border-zinc-200 bg-zinc-50/95 px-6 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95"
      >
        <div className="mx-auto flex w-full max-w-5xl items-end gap-3">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-xl bg-zinc-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

function TurnView({
  turn,
  onVote,
}: {
  turn: Turn;
  onVote: (turnId: string, vote: Vote) => void;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="self-end rounded-2xl bg-zinc-900 px-4 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
        {turn.prompt}
      </div>

      {turn.status === "loading" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {turn.status === "error" && (
        <p className="text-sm text-red-500">{turn.error}</p>
      )}

      {turn.status === "done" && turn.left && turn.right && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ResponseCard
              label="A"
              reply={turn.left}
              revealed={turn.revealed}
              won={turn.vote === "left"}
            />
            <ResponseCard
              label="B"
              reply={turn.right}
              revealed={turn.revealed}
              won={turn.vote === "right"}
            />
          </div>

          {!turn.revealed ? (
            <div className="flex flex-wrap gap-2">
              <VoteButton onClick={() => onVote(turn.id, "left")}>
                A is better
              </VoteButton>
              <VoteButton onClick={() => onVote(turn.id, "right")}>
                B is better
              </VoteButton>
              <VoteButton onClick={() => onVote(turn.id, "tie")}>
                Tie
              </VoteButton>
              <VoteButton onClick={() => onVote(turn.id, "both_bad")}>
                Both bad
              </VoteButton>
            </div>
          ) : (
            <VoteResult vote={turn.vote} left={turn.left} right={turn.right} />
          )}
        </>
      )}
    </section>
  );
}

function ResponseCard({
  label,
  reply,
  revealed,
  won,
}: {
  label: string;
  reply: ModelReply;
  revealed: boolean;
  won: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 text-sm ${
        revealed && won
          ? "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/30"
          : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
        {revealed ? MODEL_LABEL[reply.model] : `Response ${label}`}
      </div>
      {reply.error ? (
        <p className="text-red-500">{reply.error}</p>
      ) : (
        <p className="whitespace-pre-wrap text-zinc-800 dark:text-zinc-200">
          {reply.content}
        </p>
      )}
    </div>
  );
}

function VoteButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full border border-zinc-300 px-4 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {children}
    </button>
  );
}

function VoteResult({
  vote,
  left,
  right,
}: {
  vote?: Vote;
  left: ModelReply;
  right: ModelReply;
}) {
  const text =
    vote === "tie"
      ? "You called it a tie."
      : vote === "both_bad"
      ? "You marked both as bad."
      : vote === "left"
      ? `You preferred ${MODEL_LABEL[left.model]}.`
      : `You preferred ${MODEL_LABEL[right.model]}.`;

  return <p className="text-xs text-zinc-500 dark:text-zinc-400">{text}</p>;
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mb-3 h-3 w-16 rounded bg-zinc-200 dark:bg-zinc-700" />
      <div className="space-y-2">
        <div className="h-3 w-full rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-5/6 rounded bg-zinc-200 dark:bg-zinc-700" />
        <div className="h-3 w-2/3 rounded bg-zinc-200 dark:bg-zinc-700" />
      </div>
    </div>
  );
}
