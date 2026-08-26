/**
 * lib/ai/config.ts
 *
 * Centralized, server-only environment configuration for the AI layer.
 *
 * IMPORTANT: This file must only ever be imported from server-side code
 * (Route Handlers, other lib/ai/* modules). It reads process.env directly
 * and must NEVER be imported into a "use client" component, or Next.js
 * will attempt to bundle it for the browser.
 */

import { AIError, type AIProviderName } from "./types";

const VALID_PROVIDERS: readonly AIProviderName[] = ["ollama", "openai"] as const;

function isValidProvider(value: string): value is AIProviderName {
  return (VALID_PROVIDERS as readonly string[]).includes(value);
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

export interface OpenAIConfig {
  apiKey: string;
  model: string;
  timeoutMs: number;
}

/**
 * Reads and validates AI_PROVIDER. Throws a typed AIError (CONFIG_ERROR)
 * if missing/invalid so the failure is caught and reported clearly instead
 * of silently defaulting to the wrong provider.
 */
export function getActiveProviderName(): AIProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();

  if (!raw) {
    // Sensible default for local development, but explicit is better —
    // we still allow this fallback so `npm run dev` works out of the box.
    return "ollama";
  }

  if (!isValidProvider(raw)) {
    throw new AIError(
      "CONFIG_ERROR",
      "The AI service is misconfigured.",
      `Invalid AI_PROVIDER value: "${raw}". Expected one of: ${VALID_PROVIDERS.join(", ")}`
    );
  }

  return raw;
}

export function getOllamaConfig(): OllamaConfig {
  const baseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL?.trim() || "llama3.1";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 30_000;

  return { baseUrl, model, timeoutMs };
}

export function getOpenAIConfig(): OpenAIConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 30_000;

  if (!apiKey) {
    throw new AIError(
      "CONFIG_ERROR",
      "The AI service is misconfigured.",
      "Missing OPENAI_API_KEY while AI_PROVIDER=openai."
    );
  }

  return { apiKey, model, timeoutMs };
}