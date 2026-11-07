import { isClaudeNativeDocumentContext, prepareNativeProjectionCommands } from "../src/adapters/native-document-preparation.ts";
import { continuePreparation } from "../src/application/preparation-result.ts";
import { createCoreSkillSourceReader, type CoreSkillSourceReader } from "../src/adapters/core-skill-sources.ts";
import { createDistributionAssemblyRules } from "../src/adapters/distribution-source.ts";
import { projectProjectionSet } from "./projection-set.ts";
import { prepareProjectedProducts } from "../src/application/projected-products.ts";
import type { ProjectionSet, ProjectionSetRequest } from "../src/application/projection-set.ts";
import type { CoreSkillSources } from "../src/domain/core-skill-sources.ts";
import type { SkillContext } from "../src/domain/skill-definition.ts";
import type { SourceBasis } from "../src/domain/source-origin.ts";
import type { DistributionProduct } from "../src/domain/distribution-products.ts";
import { copyHarnessBinding } from "../src/domain/harness-binding.ts";
import { finding, sourceKey, type Outcome } from "../src/domain/model.ts";
export type CoreSkillProducts = { readonly projection: ProjectionSet; readonly inputs: CoreSkillSources["inputs"]; readonly products: readonly DistributionProduct[] };
export type CoreSkillProductServices = { readonly reader: CoreSkillSourceReader; readonly select: typeof selectCoreSkillProducts; readonly project: typeof projectProjectionSet; readonly products: typeof prepareProjectedProducts; readonly rules: { readonly encode: (input: { readonly text: string }) => Uint8Array } };
export const selectCoreSkillProducts = ({ sources, basis, context }: { readonly sources: CoreSkillSources; readonly basis: SourceBasis; readonly context: SkillContext }): Outcome<ProjectionSetRequest> => {
  if (basis.source.kind !== "core" || sources.skills.length === 0 || sources.skills.some((skill) => sourceKey(skill.origin.source) !== sourceKey(basis.source) || skill.origin.pin !== basis.pin)) return { status: "invalid", findings: [finding({ code: "foreign-content", subject: "core-skill-products", detail: "authored core skill products must preserve the selected framework source basis" })] };
  if ((!context.invocation.startsWith("bun ") && !isClaudeNativeDocumentContext(context))) return { status: "invalid", findings: [finding({ code: "capability-gap", subject: "core-skill-products", detail: "this producer qualifies authored skill text for Bun copy or explicit Claude native delivery" })] };
  return { status: "ok", value: { target: copyHarnessBinding({ binding: context }), units: sources.skills.map((skill) => ({ kind: "skill", key: `skill-${skill.name}`, input: { text: skill.text, origin: skill.origin, context } })) } };
};
export const createCoreSkillProductServices = (): CoreSkillProductServices => ({ reader: createCoreSkillSourceReader(), select: selectCoreSkillProducts, project: projectProjectionSet, products: prepareProjectedProducts, rules: createDistributionAssemblyRules() });
export const prepareCoreSkillProducts = ({ sourceRoot, basis, context, mode, services = createCoreSkillProductServices() }: { readonly sourceRoot: string; readonly basis: SourceBasis; readonly context: SkillContext; readonly mode: number; readonly services?: CoreSkillProductServices }): Promise<Outcome<CoreSkillProducts>> => continuePreparation({
  previous: services.reader.load({ sourceRoot, basis }), consume: async ({ prepared: sources }) => continuePreparation({
    previous: services.select({ sources, basis, context }), consume: async ({ prepared: selection }) => continuePreparation({
      previous: services.project(selection), consume: async ({ prepared: rendered }) => continuePreparation({
        previous: prepareNativeProjectionCommands({ projection: rendered, sourceRoot, basis, context }), consume: async ({ prepared: commands }) => continuePreparation({
        previous: services.products({ projection: commands.projection, sources: [basis], compiler: basis, mode, rules: services.rules }), consume: async ({ prepared: products }) => ({ status: "ok", value: { projection: commands.projection, inputs: [...sources.inputs, ...commands.inputs], products } }),
        }),
      }),
    }),
  }),
});
