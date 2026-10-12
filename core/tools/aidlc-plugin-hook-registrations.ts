import { codexHookTrustHash, codexHookTrustIdentity, type CodexHookTrustIdentityInput } from "./aidlc-command.ts";
import type { ModelHarness } from "./aidlc-model-policy.ts";
import { isModelHarness } from "./aidlc-model-policy.ts";

type PluginHookRow = {
  event: string;
  matcher?: string;
  target: string;
  capabilityId?: string;
  hookFile: string;
  pluginName: string;
};

type NativeHookGroup =
  | {
      readonly matcher?: string;
      readonly hooks: readonly { readonly type: "command"; readonly command: string; readonly timeout?: number | undefined }[];
    }
  | {
      readonly type: "command";
      readonly bash: string;
      readonly powershell: string;
      readonly timeoutSec: number;
    };

type PluginHookContribution =
  | { readonly kind: "group"; readonly path: string; readonly event: string; readonly group: NativeHookGroup }
  | { readonly kind: "target"; readonly path: string; readonly target: string; readonly hookFile: string }
  | { readonly kind: "event-body"; readonly path: string; readonly event: string; readonly hookFile: string }
  | { readonly kind: "event-row"; readonly path: string; readonly row: PluginHookRow };

type ProjectedPluginHookContributions = {
  readonly schemaVersion: 1;
  readonly pluginName: string;
  readonly harness: ModelHarness;
  readonly registrations: readonly PluginHookContribution[];
};

type HookRegistrationDocument = { readonly path: string; readonly text: string };

type PlanPluginHookRegistrationsInput = {
  readonly pluginName: string;
  readonly harness: ModelHarness;
  readonly selection: { readonly kind: "selected" } | { readonly kind: "deselected" };
  readonly previous: readonly PluginHookContribution[];
  readonly current: readonly PluginHookContribution[];
  readonly documents: readonly HookRegistrationDocument[];
};

type HookRegistrationConflict = {
  readonly kind: "hook-registration-conflict";
  readonly pluginName: string;
  readonly path: string;
  readonly identity: string;
  readonly reason: "invalid-document" | "modified-owned-value" | "missing-owned-value" | "target-collision";
};

type HookRegistrationPlanResult =
  | {
      readonly kind: "planned";
      readonly documents: readonly HookRegistrationDocument[];
      readonly ownedRegistrations: readonly PluginHookContribution[];
    }
  | { readonly kind: "conflict"; readonly error: HookRegistrationConflict };

const registrationRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function validPluginHookRow(value: unknown): value is PluginHookRow {
  return registrationRecord(value) && [value["event"], value["target"], value["hookFile"], value["pluginName"]].every((field) => typeof field === "string" && field.length > 0) &&
    (value["matcher"] === undefined || typeof value["matcher"] === "string") && (value["capabilityId"] === undefined || typeof value["capabilityId"] === "string");
}

function validNativeHookGroup(value: unknown): value is NativeHookGroup {
  if (!registrationRecord(value)) return false;
  if (value["type"] === "command") return typeof value["bash"] === "string" && typeof value["powershell"] === "string" && typeof value["timeoutSec"] === "number" && value["timeoutSec"] > 0;
  return (value["matcher"] === undefined || typeof value["matcher"] === "string") && Array.isArray(value["hooks"]) && value["hooks"].length > 0 &&
    value["hooks"].every((hook) => registrationRecord(hook) && hook["type"] === "command" && typeof hook["command"] === "string" &&
      (hook["timeout"] === undefined || (typeof hook["timeout"] === "number" && Number.isSafeInteger(hook["timeout"]) && hook["timeout"] >= 0)));
}

function validHookContribution(value: unknown): value is PluginHookContribution {
  if (!registrationRecord(value) || typeof value["path"] !== "string") return false;
  switch (value["kind"]) {
    case "group": return typeof value["event"] === "string" && validNativeHookGroup(value["group"]);
    case "target": return typeof value["target"] === "string" && typeof value["hookFile"] === "string";
    case "event-body": return typeof value["event"] === "string" && typeof value["hookFile"] === "string";
    case "event-row": return validPluginHookRow(value["row"]);
  }
  return false;
}

function validCommandHookGroup(value: unknown): value is Extract<NativeHookGroup, { readonly hooks: readonly unknown[] }> {
  return validNativeHookGroup(value) && "hooks" in value;
}

function planCodexHookTrustSeed(input: {
  document: unknown;
  hooksPath: string;
  hashHook: (input: CodexHookTrustIdentityInput) => string;
}): { kind: "planned"; text: string } | { kind: "invalid-document" } {
  if (!registrationRecord(input.document) || !registrationRecord(input.document["hooks"])) return { kind: "invalid-document" };
  const events = Object.entries(input.document["hooks"]).map(([event, groups]) => ({ event,
    groups: Array.isArray(groups) && groups.every(validCommandHookGroup) ? groups : null }));
  if (events.some(({ groups }) => groups === null)) return { kind: "invalid-document" };
  const entries = events.flatMap(({ event, groups }) => groups?.flatMap((group, groupIndex) =>
    group.hooks.map((hook, hookIndex) => {
      const eventSnake = event.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
      const hash = input.hashHook({ eventSnake, command: hook.command, matcher: group.matcher, timeout: hook.timeout });
      return `[hooks.state.${JSON.stringify(`${input.hooksPath}:${eventSnake}:${groupIndex}:${hookIndex}`)}]\ntrusted_hash = ${JSON.stringify(hash)}`;
    })) ?? []);
  return { kind: "planned", text: entries.length > 0 ? `${entries.join("\n\n")}\n` : "[hooks.state]\n" };
}

const projectedPluginHookContributionsSchema = {
  parse(value: unknown): { kind: "parsed"; value: ProjectedPluginHookContributions } | { kind: "invalid" } {
    if (!registrationRecord(value) || value["schemaVersion"] !== 1 || typeof value["pluginName"] !== "string" || typeof value["harness"] !== "string" || !isModelHarness(value["harness"]) || !Array.isArray(value["registrations"])) return { kind: "invalid" };
    const registrations = value["registrations"];
    if (!registrations.every(validHookContribution)) return { kind: "invalid" };
    const harnessDir = value["harness"] === "claude" ? ".claude" : value["harness"] === "codex" ? ".codex" : value["harness"] === "cursor" ? ".cursor" : value["harness"].startsWith("kiro") ? ".kiro" : ".aidlc";
    if (!registrations.every((registration) => {
      const expectedPath = registration.kind === "group"
        ? value["harness"] === "claude" ? `${harnessDir}/settings.json` : value["harness"] === "codex" ? `${harnessDir}/hooks.json` : value["harness"] === "copilot" ? ".github/hooks/aidlc.json" : ""
        : `${harnessDir}/hooks/${registration.kind === "event-row" ? "plugin-hook-rows.json" : "plugin-hook-targets.json"}`;
      return registration.path === expectedPath && (registration.kind === "group" || /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:ts|mjs|js)$/.test(registration.kind === "event-row" ? registration.row.hookFile : registration.hookFile));
    })) return { kind: "invalid" };
    return { kind: "parsed", value: { schemaVersion: 1, pluginName: value["pluginName"], harness: value["harness"], registrations } };
  },
};

function equalRegistrationValues(input: { left: unknown; right: unknown }): boolean {
  if (Array.isArray(input.left) && Array.isArray(input.right)) {
    const right = input.right;
    return input.left.length === right.length && input.left.every((value, index) =>
      equalRegistrationValues({ left: value, right: right[index] }));
  }
  if (registrationRecord(input.left) && registrationRecord(input.right)) {
    const right = input.right;
    return Object.keys(input.left).length === Object.keys(right).length &&
      Object.entries(input.left).every(([key, value]) => Object.hasOwn(right, key) &&
        equalRegistrationValues({ left: value, right: right[key] }));
  }
  return input.left === input.right;
}

function registrationEntries(input: { contribution: PluginHookContribution; document: unknown }): readonly unknown[] | null {
  if (input.contribution.kind === "event-row") return Array.isArray(input.document) ? input.document : null;
  if (!registrationRecord(input.document)) return null;
  if (input.contribution.kind === "target") {
    const value = input.document[input.contribution.target];
    return value === undefined ? [] : [value];
  }
  const registry = input.contribution.kind === "group" ? input.document["hooks"] ?? {} : input.document;
  if (!registrationRecord(registry)) return null;
  const entries = registry[input.contribution.event] ?? [];
  return Array.isArray(entries) ? entries : null;
}

function registrationValue(contribution: PluginHookContribution): unknown {
  switch (contribution.kind) {
    case "group": return contribution.group;
    case "target": return contribution.hookFile;
    case "event-body": return contribution.hookFile;
    case "event-row": return contribution.row;
  }
}

function writeRegistrationEntries(input: { contribution: PluginHookContribution; document: unknown; entries: readonly unknown[] }): unknown {
  if (input.contribution.kind === "event-row") return input.entries;
  if (!registrationRecord(input.document)) return input.document;
  if (input.contribution.kind === "target") {
    const target = input.contribution.target;
    return input.entries.length > 0 ? { ...input.document, [target]: input.entries[0] }
      : Object.fromEntries(Object.entries(input.document).filter(([key]) => key !== target));
  }
  if (input.contribution.kind === "event-body") return { ...input.document, [input.contribution.event]: input.entries };
  const hooks = registrationRecord(input.document["hooks"]) ? input.document["hooks"] : {};
  return { ...input.document, hooks: { ...hooks, [input.contribution.event]: input.entries } };
}

function registrationConflict(input: {
  pluginName: string;
  contribution: PluginHookContribution;
  reason: HookRegistrationConflict["reason"];
}): HookRegistrationPlanResult {
  return { kind: "conflict", error: {
    kind: "hook-registration-conflict", pluginName: input.pluginName,
    path: input.contribution.path, identity: JSON.stringify(input.contribution), reason: input.reason,
  } };
}

function planPluginHookRegistrations(input: PlanPluginHookRegistrationsInput): HookRegistrationPlanResult {
  const parsed = new Map<string, unknown>();
  try {
    input.documents.forEach((document) => {
      const value: unknown = JSON.parse(document.text);
      parsed.set(document.path, value);
    });
  } catch {
    return { kind: "conflict", error: { kind: "hook-registration-conflict", pluginName: input.pluginName, path: "", identity: "", reason: "invalid-document" } };
  }
  const originals = new Map(parsed);
  const previousConflict = input.previous.map((contribution) => {
    const entries = registrationEntries({ contribution, document: parsed.get(contribution.path) });
    if (entries === null) return registrationConflict({ pluginName: input.pluginName, contribution, reason: "invalid-document" });
    if (entries.some((entry) => equalRegistrationValues({ left: entry, right: registrationValue(contribution) }))) return null;
    if (contribution.kind === "target" && entries.length === 0) return null;
    return registrationConflict({ pluginName: input.pluginName, contribution, reason: contribution.kind === "target" ? "modified-owned-value" : "missing-owned-value" });
  }).find((result) => result !== null);
  if (previousConflict) return previousConflict;
  const current = input.selection.kind === "selected" ? input.current : [];
  const owned = input.previous.filter((previous) => current.some((contribution) =>
    equalRegistrationValues({ left: previous, right: contribution })));
  input.previous.filter((previous) => !owned.includes(previous)).forEach((contribution) => {
    const document = parsed.get(contribution.path);
    const entries = registrationEntries({ contribution, document });
    if (entries === null) return;
    const ownedIndex = entries.findIndex((entry) => equalRegistrationValues({ left: entry, right: registrationValue(contribution) }));
    parsed.set(contribution.path, writeRegistrationEntries({ contribution, document,
      entries: entries.filter((_entry, index) => index !== ownedIndex) }));
  });
  const currentConflict = current.map((contribution) => {
    const document = parsed.get(contribution.path);
    const entries = registrationEntries({ contribution, document });
    if (entries === null) return registrationConflict({ pluginName: input.pluginName, contribution, reason: "invalid-document" });
    if (entries.some((entry) => equalRegistrationValues({ left: entry, right: registrationValue(contribution) }))) return null;
    if (contribution.kind === "target" && entries.length > 0) return registrationConflict({ pluginName: input.pluginName, contribution, reason: "target-collision" });
    parsed.set(contribution.path, writeRegistrationEntries({ contribution, document,
      entries: [...entries, registrationValue(contribution)] }));
    owned.push(contribution);
    return null;
  }).find((result) => result !== null);
  if (currentConflict) return currentConflict;
  return {
    kind: "planned",
    documents: input.documents.map((document) => {
      const value = parsed.get(document.path);
      return equalRegistrationValues({ left: originals.get(document.path), right: value })
        ? document : { path: document.path, text: JSON.stringify(value, null, 2) + "\n" };
    }),
    ownedRegistrations: owned,
  };
}

export {
  type HookRegistrationConflict,
  type HookRegistrationDocument,
  type HookRegistrationPlanResult,
  type NativeHookGroup,
  type PlanPluginHookRegistrationsInput,
  type PluginHookContribution,
  type PluginHookRow,
  type ProjectedPluginHookContributions,
  planPluginHookRegistrations,
  type CodexHookTrustIdentityInput,
  codexHookTrustHash,
  codexHookTrustIdentity,
  planCodexHookTrustSeed,
  projectedPluginHookContributionsSchema,
};
