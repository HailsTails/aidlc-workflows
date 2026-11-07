import type { AgentOrigin, AuthoredAgent } from "./agent-definition.ts";
import { finding, sourceKey, type Outcome } from "./model.ts";

export type WorkerAdmissions = {
  readonly origin: AgentOrigin;
  readonly name: string;
  readonly verbs: Readonly<Record<string, readonly string[]>>;
};
export type WorkerAdmissionBinding = {
  readonly template: { readonly origin: AgentOrigin; readonly name: string };
  readonly target: AuthoredAgent;
  readonly authority: AgentOrigin;
};
export type WorkerPolicyBasis =
  | { readonly kind: "native-source" }
  | { readonly kind: "declared-extension"; readonly pin: string };
const canonicalAdmissions = ({ verbs }: { readonly verbs: WorkerAdmissions["verbs"] }): string =>
  JSON.stringify(Object.entries(verbs).sort(([left], [right]) => left.localeCompare(right)).map(([script, admitted]) => [script, [...new Set(admitted)].sort()]));
export const bindWorkerAdmissions = ({ template, target, templateAdmissions, targetAdmissions }: {
  readonly template: WorkerAdmissionBinding["template"];
  readonly target: AuthoredAgent;
  readonly templateAdmissions: WorkerAdmissions;
  readonly targetAdmissions: WorkerAdmissions;
}): Outcome<WorkerAdmissionBinding> => {
  if (template.name !== templateAdmissions.name || target.name !== targetAdmissions.name ||
    template.origin.pin !== target.origin.pin || target.origin.pin !== templateAdmissions.origin.pin ||
    target.origin.pin !== targetAdmissions.origin.pin ||
    templateAdmissions.origin.path !== targetAdmissions.origin.path ||
    sourceKey(templateAdmissions.origin.source) !== sourceKey(targetAdmissions.origin.source))
    return { status: "invalid", findings: [finding({ code: "foreign-content", subject: target.name, detail: "worker policy and command admissions must name their actors and share a pin and admission authority" })] };
  if (canonicalAdmissions({ verbs: templateAdmissions.verbs }) !== canonicalAdmissions({ verbs: targetAdmissions.verbs }))
    return { status: "invalid", findings: [finding({ code: "capability-gap", subject: target.name, detail: "worker policy reuse requires equivalent command admissions; select or prepare a role-specific policy" })] };
  return { status: "ok", value: { template, target, authority: targetAdmissions.origin } };
};
