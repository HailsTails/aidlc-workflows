import type { AgentSlug } from "./identities.ts";
import type { Method } from "./method.ts";

export const reviewerAgentSet = (method: Method): ReadonlySet<AgentSlug> =>
  new Set(method.stages.flatMap((stage) => stage.review ? [stage.review.reviewer] : []));

export const inlineAgentSet = (method: Method): ReadonlySet<AgentSlug> =>
  new Set(method.stages.filter((stage) => stage.owner.kind === "core").flatMap((stage) => {
    const lead = stage.participation.lead.kind === "agent" ? [stage.participation.lead.agent] : [];
    return stage.participation.mode === "inline" ? [...lead, ...stage.participation.supports]
      : stage.participation.mode === "mob" ? lead : [];
  }));
