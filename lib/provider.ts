export function killSwitchOn(): boolean {
  return process.env.CHAT_DISABLED === "1" || process.env.CHAT_DISABLED === "true";
}

export function gatewayModelId(): string {
  return process.env.GATEWAY_MODEL?.trim() || "google/gemini-2.5-flash-lite";
}

function gatewayAvailable(): boolean {
  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() ||
      process.env.VERCEL_OIDC_TOKEN?.trim() ||
      process.env.VERCEL === "1",
  );
}

export function resolveModel() {
  if (!gatewayAvailable()) {
    throw new Error("NO_BACKEND");
  }
  return gatewayModelId();
}
