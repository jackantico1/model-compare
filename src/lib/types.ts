export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Internal model key. "left"/"right" are the blind, randomized slots shown in the UI;
// they get mapped to an actual ModelKey per-turn so the user can't tell which is which until they vote.
export type ModelKey = "qwen" | "llama";

export interface ModelReply {
  model: ModelKey;
  content: string;
  error?: string;
}

export interface CompareRequestBody {
  qwenMessages: ChatMessage[];
  llamaMessages: ChatMessage[];
}

export interface CompareResponseBody {
  left: ModelReply;
  right: ModelReply;
}

export type Vote = "left" | "right" | "tie" | "both_bad";
