import { z } from "zod";
import type { SourceOrigin } from "../domain/source-origin.ts";
import { runnerRequestKey, type RunnerCompiler, type GeneratedRunner } from "../domain/generated-runner.ts";
import { finding, type Outcome } from "../domain/model.ts";
import { createRunnerProcess, type RunnerProcess, type RunnerRuntime, type KeyedRunnerRequest } from "./runner-process.ts";
import { parseGeneratedRunner } from "./generated-runner-source.ts";

const owner = z.discriminatedUnion("kind", [z.strictObject({ kind: z.literal("core"), id: z.literal("framework") }), z.strictObject({ kind: z.literal("plugin"), id: z.string().regex(/^[a-z][a-z0-9-]*$/) })]);
const response = z.array(z.discriminatedUnion("status", [z.strictObject({ status: z.literal("ok"), key: z.string(), owner, markdown: z.string() }), z.strictObject({ status: z.literal("unavailable"), key: z.string(), detail: z.string().min(1) })]));
export type RunnerCompilerRules = { readonly parse: typeof parseGeneratedRunner; readonly key: typeof runnerRequestKey };
export const createRunnerCompilerRules = (): RunnerCompilerRules => ({ parse: parseGeneratedRunner, key: runnerRequestKey });
const products = ({ replies, requests, runtime, compiler, rules }: { readonly replies: z.infer<typeof response>; readonly requests: readonly KeyedRunnerRequest[]; readonly runtime: RunnerRuntime; readonly compiler: SourceOrigin; readonly rules: RunnerCompilerRules }): Outcome<readonly GeneratedRunner[]> => {
  if (replies.length !== requests.length || replies.some((reply, index) => reply.key !== requests[index]?.key))
    return { status: "invalid", findings: [finding({ code: "invalid-input", subject: compiler.path, detail: "runner compiler response must match every requested identity in order" })] };
  const decoded = replies.map((reply, index): Outcome<GeneratedRunner> => {
    if (reply.status === "unavailable") return { status: "invalid", findings: [finding({ code: "capability-gap", subject: reply.key, detail: reply.detail })] };
    const request = requests[index];
    if (request === undefined) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: reply.key, detail: "runner request is missing" })] };
    return rules.parse({ markdown: reply.markdown, compiler, owner: reply.owner, binding: runtime.binding, request: request.request });
  });
  const findings = decoded.flatMap((entry) => entry.status === "invalid" ? entry.findings : []);
  if (findings.length > 0) return { status: "invalid", findings };
  return { status: "ok", value: decoded.flatMap((entry) => entry.status === "ok" ? [entry.value] : []) };
};
export const createLegacyRunnerCompiler = ({ runtime, compiler, process = createRunnerProcess(), rules = createRunnerCompilerRules() }: { readonly runtime: RunnerRuntime; readonly compiler: SourceOrigin; readonly process?: RunnerProcess; readonly rules?: RunnerCompilerRules }): RunnerCompiler => ({
  compile: ({ requests }) => {
    const identified = requests.map((request) => ({ key: rules.key({ request }), request }));
    const executed = process.execute({ runtime, requests: identified });
    if (executed.status === "invalid") return executed;
    const parsed = response.safeParse(executed.value);
    if (!parsed.success) return { status: "invalid", findings: [finding({ code: "invalid-input", subject: compiler.path, detail: "runner compiler returned an invalid response envelope" })] };
    return products({ replies: parsed.data, requests: identified, runtime, compiler, rules });
  },
});
