import { NextRequest, NextResponse } from "next/server";
import { getModelReply } from "@/lib/runpod";
import type { CompareRequestBody, CompareResponseBody } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: CompareRequestBody = await req.json();

  if (!Array.isArray(body.qwenMessages) || !Array.isArray(body.llamaMessages)) {
    return NextResponse.json(
      { error: "qwenMessages and llamaMessages are required" },
      { status: 400 }
    );
  }

  const [qwen, llama] = await Promise.all([
    getModelReply("qwen", body.qwenMessages),
    getModelReply("llama", body.llamaMessages),
  ]);

  // Randomize left/right slots per turn so the UI can stay blind about which
  // model is which until the user has voted.
  const swap = Math.random() < 0.5;
  const response: CompareResponseBody = swap
    ? { left: llama, right: qwen }
    : { left: qwen, right: llama };

  return NextResponse.json(response);
}
