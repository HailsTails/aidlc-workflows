import { collectCommandRenderings } from "./command-renderers.ts";
import type { DocumentProjection } from "./ports/documents.ts";

export const projectMethodDocuments: DocumentProjection = (request) => {
  const harness = request.render({ fills: request.fills, tokens: request.tokens,
    bindingHeadings: request.bindingHeadings });
  return collectCommandRenderings([
    harness.renderOnboarding({ templates: request.surface.onboarding, method: request.method }),
    ...request.surface.documents.map((document) => harness.placeNeutralDocument({ document })),
  ]);
};
