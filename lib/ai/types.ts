/**
 * lib/ai/types.ts
 *
 * Shared, provider-agnostic contracts for the AI abstraction layer.
 * Nothing in this file should import a specific SDK (OpenAI, Ollama, etc).
 */

/** Supported provider identifiers. Extend this union when adding a new provider. */
export type AIProviderName = "ollama" | "openai";

/** Normalized input every provider implementation must accept. */
export interface AIGenerateRequest {
  /** The user/system prompt to send to the model. */
  prompt: string;
  /** Optional system instruction, if the provider/model supports it. */
  system?: string;
  /** Sampling temperature, 0-2. Providers should clamp/ignore if unsupported. */
  temperature?: number;
  /** Max tokens to generate. Providers should clamp to their own limits. */
  maxTokens?: number;
}

/** Normalized output every provider implementation must return. */
export interface AIGenerateResponse {
  /** The generated text. */
  text: string;
  /** Which provider actually served this request. */
  provider: AIProviderName;
  /** Which underlying model served this request. */
  model: string;
  /** Optional token usage, when the provider reports it. */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Error codes the route layer can safely map to HTTP status codes.
 * Keep this list stable — the route handler switches on it.
 */
export type AIErrorCode =
  | "INVALID_REQUEST"
  | "PROVIDER_TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "PROVIDER_AUTH_ERROR"
  | "PROVIDER_ERROR"
  | "CONFIG_ERROR";

/**
 * A typed error class used across the AI layer so route.ts can catch a single
 * error type and safely decide what (if anything) to expose to the client.
 */
export class AIError extends Error {
  public readonly code: AIErrorCode;
  /** Safe to show to the end user. Never put internal details here. */
  public readonly publicMessage: string;

  constructor(code: AIErrorCode, publicMessage: string, internalMessage?: string) {
    super(internalMessage ?? publicMessage);
    this.name = "AIError";
    this.code = code;
    this.publicMessage = publicMessage;
  }
}

/**
 * The contract every AI provider must implement.
 * The route handler and factory only ever depend on this interface.
 */
export interface AIProvider {
  readonly name: AIProviderName;
  generate(request: AIGenerateRequest, signal: AbortSignal): Promise<AIGenerateResponse>;
}