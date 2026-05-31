export type ModelCallArgs = {
  apiKey: string;
  prompt: string;
  model?: string;
};

export type StreamPhase =
  | "idle"
  | "building_prompt"
  | "sending"
  | "waiting"
  | "streaming"
  | "parsing"
  | "applying"
  | "cooldown"
  | "error";

export type StreamCallbacks = {
  onPhase?: (phase: StreamPhase) => void;
  onDelta?: (chunk: string, accumulated: string) => void;
  onEvent?: (event: { type: string; raw: unknown }) => void;
};

const ENDPOINT = "https://api.openai.com/v1/responses";

/** Non-streaming, kept for legacy callers. */
export async function callOpenAI({
  apiKey,
  prompt,
  model = "gpt-4.1-mini",
}: ModelCallArgs): Promise<string> {
  if (!apiKey.trim()) throw new Error("Missing OpenAI API key.");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.82,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error("OpenAI request failed: " + response.status + " " + text.slice(0, 300));
  }

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };

  const outputText =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content?.map((c) => c.text ?? "").filter(Boolean) ?? [])
      .join("\n") ??
    "";

  if (!outputText.trim()) throw new Error("OpenAI returned no text.");
  return outputText;
}

/**
 * Streaming call against the OpenAI Responses API (SSE).
 * Accumulates `response.output_text.delta` events into a single string,
 * surfaces phase + delta updates, and returns the complete text when done.
 */
export async function callOpenAIStream(
  args: ModelCallArgs & StreamCallbacks,
): Promise<string> {
  const { apiKey, prompt, model = "gpt-4.1-mini", onPhase, onDelta, onEvent } = args;
  if (!apiKey.trim()) throw new Error("Missing OpenAI API key.");

  onPhase?.("sending");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model,
      input: prompt,
      temperature: 0.82,
      stream: true,
    }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(
      "OpenAI request failed: " + response.status + " " + text.slice(0, 300),
    );
  }

  onPhase?.("waiting");

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let accumulated = "";
  let sawFirstDelta = false;
  let outOfBandText = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sepIdx: number;
    // SSE events are separated by blank lines (\n\n)
    while ((sepIdx = buffer.indexOf("\n\n")) !== -1) {
      const rawEvent = buffer.slice(0, sepIdx);
      buffer = buffer.slice(sepIdx + 2);
      const dataLines = rawEvent
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());
      if (!dataLines.length) continue;
      const payload = dataLines.join("\n");
      if (!payload || payload === "[DONE]") continue;

      let evt: { type?: string; delta?: string; text?: string; error?: { message?: string } } | null = null;
      try {
        evt = JSON.parse(payload);
      } catch {
        // ignore malformed lines
        continue;
      }
      if (!evt || typeof evt !== "object") continue;
      onEvent?.({ type: evt.type ?? "unknown", raw: evt });

      if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") {
        if (!sawFirstDelta) {
          sawFirstDelta = true;
          onPhase?.("streaming");
        }
        accumulated += evt.delta;
        onDelta?.(evt.delta, accumulated);
      } else if (evt.type === "response.output_text.done" && typeof evt.text === "string") {
        // Defensive: use full text if no deltas surfaced.
        if (!accumulated) {
          accumulated = evt.text;
          onDelta?.(evt.text, accumulated);
        }
      } else if (evt.type === "response.completed") {
        // Some servers attach final text on response.completed.response.output[…].content[…].text
        // It's already been streamed via deltas in normal cases.
      } else if (evt.type === "response.error" || evt.type === "error") {
        const msg = evt.error?.message ?? "Unknown streaming error.";
        throw new Error("OpenAI stream error: " + msg);
      } else if (
        evt.type === "response.output_text" &&
        typeof (evt as { text?: string }).text === "string"
      ) {
        // Some intermediaries flatten to a single output_text event.
        outOfBandText += (evt as { text?: string }).text ?? "";
      }
    }
  }

  if (!accumulated && outOfBandText) accumulated = outOfBandText;
  if (!accumulated.trim()) throw new Error("OpenAI stream returned no text.");
  return accumulated;
}
