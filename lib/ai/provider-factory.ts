/**
 * lib/ai/provider-factory.ts
 *
 * The single place that decides which AIProvider implementation to use,
 * based on the AI_PROVIDER environment variable. Everything else in the
 * app (route.ts) depends only on the AIProvider interface, never on a
 * concrete provider class. To add a new provider:
 *
 *   1. Implement AIProvider in lib/ai/providers/<name>.ts
 *   2. Add "<name>" to AIProviderName in lib/ai/types.ts
 *   3. Add a case below
 */

import { getActiveProviderName } from "./config";
import type { AIProvider } from "./types";
import { OllamaProvider } from "./providers/ollama";
import { OpenAIProvider } from "./providers/openai";

let cachedProvider: AIProvider | null = null;
let cachedProviderName: string | null = null;

function createProvider(): AIProvider {
  const providerName = getActiveProviderName();

  switch (providerName) {
    case "ollama":
      return new OllamaProvider();
    case "openai":
      return new OpenAIProvider();
    default: {
      // Exhaustiveness check — TypeScript will error here if a new
      // AIProviderName is added without a corresponding case above.
      const _exhaustive: never = providerName;
      throw new Error(`Unhandled AI provider: ${_exhaustive}`);
    }
  }
}

/**
 * Returns the active AIProvider instance for the current AI_PROVIDER config.
 * Cached per server process; re-created if AI_PROVIDER changes (e.g. in
 * dev with different env between restarts) since Next.js reloads the
 * module on restart anyway.
 */
export function getAIProvider(): AIProvider {
  const currentName = getActiveProviderName();
  if (!cachedProvider || cachedProviderName !== currentName) {
    cachedProvider = createProvider();
    cachedProviderName = currentName;
  }
  return cachedProvider;
}