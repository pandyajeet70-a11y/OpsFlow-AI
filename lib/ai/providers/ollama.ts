/**
 * lib/ai/providers/ollama.ts
 *
 * AIProvider implementation backed by a local Ollama instance.
 * Talks to Ollama's REST API (http://localhost:11434 by default) via plain
 * fetch — no SDK dependency required.
 *
 * Server-only. Do not import from client components.
 */

import { AIError, type AIProvider, type AIGenerateRequest, type AIGenerateResponse } from "../types";
import { getOllamaConfig } from "../config";

interface OllamaGenerateApiResponse {
  model: string;
  response: string;
  done: boolean;
  prompt_eval_count?: number;
  eval_count?: number;
}

export class OllamaProvider implements AIProvider {
  public readonly name = "ollama" as const;

  async generate(request: AIGenerateRequest, signal: AbortSignal): Promise<AIGenerateResponse> {
    const { baseUrl, model } = getOllamaConfig();

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
        body: JSON.stringify({
          model,
          prompt: request.prompt,
          system: request.system,
          stream: false,
          options: {
            temperature: request.temperature ?? 0.7,
            num_predict: request.maxTokens ?? 512,
          },
        }),
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIError(
          "PROVIDER_TIMEOUT",
          "The AI request timed out. Please try again.",
          `Ollama request timed out: ${err.message}`
        );
      }
      throw new AIError(
        "PROVIDER_UNAVAILABLE",
        "The local AI provider is unavailable. Is Ollama running?",
        `Failed to reach Ollama at ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      throw new AIError(
        "PROVIDER_ERROR",
        "The AI provider returned an error.",
        `Ollama responded with ${res.status} ${res.statusText}: ${bodyText}`
      );
    }

    let data: OllamaGenerateApiResponse;
    try {
      data = (await res.json()) as OllamaGenerateApiResponse;
    } catch (err) {
      throw new AIError(
        "PROVIDER_ERROR",
        "The AI provider returned an unreadable response.",
        `Failed to parse Ollama JSON response: ${err instanceof Error ? err.message : String(err)}`
      );
    }

    return {
      text: data.response ?? "",
      provider: "ollama",
      model: data.model ?? model,
      usage: {
        promptTokens: data.prompt_eval_count,
        completionTokens: data.eval_count,
        totalTokens:
          data.prompt_eval_count !== undefined && data.eval_count !== undefined
            ? data.prompt_eval_count + data.eval_count
            : undefined,
      },
    };
  }
}