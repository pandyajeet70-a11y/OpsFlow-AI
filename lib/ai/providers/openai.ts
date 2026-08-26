/**
 * lib/ai/providers/openai.ts
 *
 * AIProvider implementation backed by the OpenAI API.
 * Not active by default — enabled by setting AI_PROVIDER=openai.
 *
 * Server-only. Do not import from client components. The API key is only
 * ever read from process.env on the server and is never sent to the client.
 */

import OpenAI from "openai";
import { AIError, type AIProvider, type AIGenerateRequest, type AIGenerateResponse } from "../types";
import { getOpenAIConfig } from "../config";

export class OpenAIProvider implements AIProvider {
  public readonly name = "openai" as const;

  async generate(request: AIGenerateRequest, signal: AbortSignal): Promise<AIGenerateResponse> {
    const { apiKey, model } = getOpenAIConfig();
    const client = new OpenAI({ apiKey });

    try {
      const completion = await client.chat.completions.create(
        {
          model,
          temperature: request.temperature ?? 0.7,
          max_tokens: request.maxTokens ?? 512,
          messages: [
            ...(request.system ? [{ role: "system" as const, content: request.system }] : []),
            { role: "user" as const, content: request.prompt },
          ],
        },
        { signal }
      );

      const text = completion.choices[0]?.message?.content ?? "";

      return {
        text,
        provider: "openai",
        model: completion.model ?? model,
        usage: {
          promptTokens: completion.usage?.prompt_tokens,
          completionTokens: completion.usage?.completion_tokens,
          totalTokens: completion.usage?.total_tokens,
        },
      };
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIError(
          "PROVIDER_TIMEOUT",
          "The AI request timed out. Please try again.",
          `OpenAI request timed out: ${err.message}`
        );
      }

      if (err instanceof OpenAI.APIError) {
        if (err.status === 401 || err.status === 403) {
          throw new AIError(
            "PROVIDER_AUTH_ERROR",
            "The AI provider rejected the request credentials.",
            `OpenAI auth error: ${err.status} ${err.message}`
          );
        }
        if (err.status === 429) {
          throw new AIError(
            "PROVIDER_ERROR",
            "The AI provider is rate-limited or out of credits. Please try again later.",
            `OpenAI rate limit / quota error: ${err.status} ${err.message}`
          );
        }
        throw new AIError(
          "PROVIDER_ERROR",
          "The AI provider returned an error.",
          `OpenAI API error: ${err.status} ${err.message}`
        );
      }

      throw new AIError(
        "PROVIDER_UNAVAILABLE",
        "The AI provider is unavailable.",
        `Failed to reach OpenAI: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
}   