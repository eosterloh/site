import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { GatewayProviderOptions } from "@ai-sdk/gateway";
import { gateway, type LanguageModel } from "ai";

const DEFAULT_MODEL = "google/gemini-3.8-flash";
const LEGACY_MODELS = new Set(["google/gemini-2.5-flash-lite"]);

const GATEWAY_FALLBACK_MODELS = [
  "openai/gpt-5.4-mini",
  "google/gemini-3.5-flash-lite",
  "google/gemini-2.5-flash",
];

export function killSwitchOn(): boolean {
  return process.env.CHAT_DISABLED === "1" || process.env.CHAT_DISABLED === "true";
}

export function gatewayModelId(): string {
  const configured = process.env.GATEWAY_MODEL?.trim();
  if (!configured || LEGACY_MODELS.has(configured)) {
    return DEFAULT_MODEL;
  }
  return configured;
}

export function isGatewayActive(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

export function resolveModel(): LanguageModel {
  const modelId = gatewayModelId();

  if (isGatewayActive()) {
    return gateway(modelId);
  }

  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    const openrouter = createOpenAICompatible({
      name: "openrouter",
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: openRouterKey,
    });
    return openrouter(modelId);
  }

  throw new Error("NO_BACKEND");
}

export function resolveProviderOptions():
  | { gateway: { models: string[] } }
  | undefined {
  if (!isGatewayActive()) return undefined;
  const primary = gatewayModelId();
  const models = GATEWAY_FALLBACK_MODELS.filter((id) => id !== primary);
  return {
    gateway: {
      models,
    } satisfies GatewayProviderOptions,
  };
}
