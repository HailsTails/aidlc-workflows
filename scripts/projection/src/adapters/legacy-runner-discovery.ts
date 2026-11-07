import { z } from "zod";
import type { SourceOrigin } from "../domain/source-origin.ts";
import type { RunnerDiscovery, GeneratedRunner, DiscoveredRunners } from "../domain/generated-runner.ts";
import { runnerRequestKey } from "../domain/generated-runner.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { createRunnerProcess, type RunnerProcess, type RunnerRuntime } from "./runner-process.ts";
import { parseGeneratedRunner } from "./generated-runner-source.ts";
const owner = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("core"), id: z.literal("framework") }), z.strictObject({ kind: z.literal("plugin"), id: z.string().regex(/^[a-z][a-z0-9-]*$/) })]);
const slug = z.string().regex(/^[a-z][a-z0-9-]*$/);
const request = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("stage"), slug }), z.strictObject({ kind: z.literal("scope"), scope: slug }), z.strictObject({ kind: z.literal("init") }), z.strictObject({ kind: z.literal("compose") })]);
const inputDigest = z.strictObject({ path: z.string().min(1), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const directoryInput = z.strictObject({ path: z.string().min(1), status: z.enum(["present", "absent"]) });
const response = z.discriminatedUnion("status", [z.strictObject({ status: z.literal("unavailable"), detail: z.string().min(1) }), z.strictObject({ status: z.literal("ok"), scope: z.enum(["native-stage-and-scope-runners", "native-generated-runners"]), skillRoot: z.string().min(1), entries: z.array(z.strictObject({ request, owner, markdown: z.string() })), inputs: z.array(inputDigest).min(3), directoryInputs: z.array(directoryInput).length(2) })]);
export type RunnerDiscoveryRules = { readonly parse: typeof parseGeneratedRunner; readonly key: typeof runnerRequestKey };
export const createRunnerDiscoveryRules = (): RunnerDiscoveryRules => ({ parse: parseGeneratedRunner, key: runnerRequestKey });
const decodeDiscovery = ({ reply, runtime, compiler, rules }: { readonly reply: unknown; readonly runtime: RunnerRuntime; readonly compiler: SourceOrigin; readonly rules: RunnerDiscoveryRules }): Outcome<DiscoveredRunners> => {
    const parsed = response.safeParse(reply);
    if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: compiler.path, detail: "native runner discovery must return scoped definitions and input digests, or an unavailability finding" })] };
    if (parsed.data.status === "unavailable") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: runtime.binding.harness, detail: parsed.data.detail })] };
    const keys = parsed.data.entries.map((entry) => rules.key({ request: entry.request }));
    const shortcuts = parsed.data.entries.filter((entry) => entry.request.kind === "init" || entry.request.kind === "compose");
    if (parsed.data.scope === "native-generated-runners" && (!keys.includes("init") || !keys.includes("compose")) || parsed.data.scope === "native-stage-and-scope-runners" && shortcuts.length > 0 || shortcuts.some((entry) => entry.owner.kind !== "core" || entry.owner.id !== "framework"))
      return { status: "invalid", findings: [finding({ code: "capability-gap", subject: compiler.path, detail: "generated-runner coverage requires core init and compose shortcuts; a stage/scope-only catalogue must not claim them" })] };
    if (new Set(keys).size !== keys.length || new Set(parsed.data.inputs.map((entry) => entry.path)).size !== parsed.data.inputs.length || new Set(parsed.data.directoryInputs.map((entry) => entry.path)).size !== parsed.data.directoryInputs.length)
      return { status: "invalid", findings: [finding({ code: "duplicate", subject: compiler.path, detail: "native discovery must report each runner identity and input path once" })] };
    const decoded: readonly Outcome<GeneratedRunner>[] = parsed.data.entries.map((entry) => rules.parse({ markdown: entry.markdown, compiler, owner: entry.owner, binding: runtime.binding, request: entry.request }));
    const findings = decoded.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
    return findings.length > 0 ? { status: "invalid", findings } : { status: "ok", value: { scope: parsed.data.scope, binding: runtime.binding, compiler, skillRoot: parsed.data.skillRoot, inputs: parsed.data.inputs, directoryInputs: parsed.data.directoryInputs, runners: decoded.flatMap((entry) => entry.status === "ok" ? [entry.value] : []) } };
};
export const createLegacyRunnerDiscovery = ({ runtime, compiler, process = createRunnerProcess(), rules = createRunnerDiscoveryRules() }: { readonly runtime: RunnerRuntime; readonly compiler: SourceOrigin; readonly process?: RunnerProcess; readonly rules?: RunnerDiscoveryRules }): RunnerDiscovery => ({
  discover: () => {
    const executed = process.execute({ runtime, requests: [], intent: "discover" });
    return executed.status === "invalid" ? executed : decodeDiscovery({ reply: executed.value, runtime, compiler, rules });
  },
});
