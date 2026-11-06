// Older installers accept the base policy; readers restore only extensions they know.
const EXTENDED_POLICIES: readonly string[] = ["jsonc-settings", "json-entries"];

export function encodeRootIntegration<T extends { readonly policy: string }>({ integration }: {
  readonly integration: T;
}): T | (Omit<T, "policy"> & { policy: "whole-file"; extendedPolicy: string }) {
  return EXTENDED_POLICIES.includes(integration.policy)
    ? { ...integration, policy: "whole-file", extendedPolicy: integration.policy }
    : integration;
}

export function decodeRootIntegrations({ value: wireIntegrations }: { readonly value: unknown }): unknown {
  if (!Array.isArray(wireIntegrations)) return wireIntegrations;
  return wireIntegrations.map((wireIntegration: unknown) => {
    if (!wireIntegration || typeof wireIntegration !== "object" || !("extendedPolicy" in wireIntegration)) return wireIntegration;
    const { extendedPolicy, ...integration } = wireIntegration;
    if (typeof extendedPolicy !== "string" || !EXTENDED_POLICIES.includes(extendedPolicy)) return integration;
    return { ...integration, policy: extendedPolicy };
  });
}
