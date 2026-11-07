// The only file that knows which LLM provider we use. Swap the provider here.
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";
import { cfg } from "./config.js";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!cfg.llmApiKey) throw new Error("LLM_API_KEY not set");
  client ??= new Anthropic({ apiKey: cfg.llmApiKey, maxRetries: 1 });
  return client;
}

export function llmAvailable(): boolean {
  return Boolean(cfg.llmApiKey);
}

/** Structured JSON output validated against a zod schema. */
export async function llmJson<T extends z.ZodType>(
  system: string,
  user: string,
  schema: T,
  timeoutMs: number,
): Promise<z.infer<T>> {
  const res = await getClient().messages.parse(
    {
      model: cfg.llmModel,
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { format: zodOutputFormat(schema), effort: "low" },
    },
    { timeout: timeoutMs },
  );
  if (res.stop_reason === "refusal") throw new Error("LLM refused");
  if (res.parsed_output == null) throw new Error("LLM returned no parsable output");
  return schema.parse(res.parsed_output);
}

/** Plain text answer. */
export async function llmText(system: string, user: string, timeoutMs: number): Promise<string> {
  const res = await getClient().messages.create(
    {
      model: cfg.llmModel,
      max_tokens: 1000,
      system,
      messages: [{ role: "user", content: user }],
      output_config: { effort: "low" },
    },
    { timeout: timeoutMs },
  );
  if (res.stop_reason === "refusal") throw new Error("LLM refused");
  return res.content
    .flatMap((b) => (b.type === "text" ? [b.text] : []))
    .join("")
    .trim();
}
