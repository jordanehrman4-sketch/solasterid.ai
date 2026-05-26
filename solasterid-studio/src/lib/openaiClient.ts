export type ModelCallArgs = {
  apiKey: string;
  prompt: string;
  model?: string;
};

export async function callOpenAI({
  apiKey,
  prompt,
  model = "gpt-4.1-mini",
}: ModelCallArgs): Promise<string> {
  if (!apiKey.trim()) throw new Error("Missing OpenAI API key.");

  const response = await fetch("https://api.openai.com/v1/responses", {
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

  const data = await response.json() as {
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
