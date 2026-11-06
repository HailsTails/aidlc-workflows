import { finding, pathStatus, type Finding, type Outcome, type DocumentSource } from "./model.ts";
import { residue, type ProjectionContent } from "./projection-content.ts";
export type NativeResource = {
  readonly kind: "file" | "registration";
  readonly path: string;
  readonly body: string;
};
export type HarnessTarget = {
  readonly harness: string;
  readonly harnessDir: string;
  readonly render: (document: ProjectionContent) => Outcome<readonly NativeResource[]>;
};
export type NativeContribution = {
  readonly harness: string;
  readonly unit: string;
  readonly source: DocumentSource;
  readonly resources: readonly NativeResource[];
};
export type NativeRenderingInput = {
  readonly document: ProjectionContent;
  readonly target: HarnessTarget;
};
export type NativeValidation = {
  readonly pathStatus: typeof pathStatus;
  readonly residue: typeof residue;
};
export type NativeRenderer = (input: NativeRenderingInput) => Outcome<readonly NativeResource[]>;
export const createNativeValidation = (): NativeValidation => ({ pathStatus, residue });
const targetFindings = ({ document, target }: NativeRenderingInput): readonly Finding[] => {
  if (document.harness !== target.harness)
    return [
      finding({
        code: "harness-mismatch",
        subject: document.key,
        detail: `document for ${document.harness}, adapter for ${target.harness}`,
      }),
    ];
  if (document.harnessDir !== target.harnessDir)
    return [
      finding({
        code: "directory-mismatch",
        subject: document.key,
        detail: `content for ${document.harnessDir}, adapter for ${target.harnessDir}`,
      }),
    ];
  return [];
};

const resourceFindings = ({
  document,
  resources,
  validation,
}: {
  readonly document: ProjectionContent;
  readonly resources: readonly NativeResource[];
  readonly validation: NativeValidation;
}): readonly Finding[] => [
  ...resources.flatMap((resource) => [
    ...(validation.pathStatus({ path: resource.path }) === "unsafe"
      ? [finding({ code: "invalid-destination", subject: document.key, detail: resource.path })]
      : []),
    ...validation.residue({ text: resource.body, subject: resource.path }),
  ]),
  ...(resources.length === 0
    ? [
        finding({
          code: "empty-integration",
          subject: document.key,
          detail: "adapter emitted no resources",
        }),
      ]
    : []),
  ...(document.hook !== null && !resources.some((resource) => resource.kind === "registration")
    ? [
        finding({
          code: "missing-registration",
          subject: document.key,
          detail: "reviewer body and hook must travel together",
        }),
      ]
    : []),
  ...(!resources.some((resource) => resource.kind === "file")
    ? [
        finding({
          code: "missing-body",
          subject: document.key,
          detail: "adapter must emit a document body",
        }),
      ]
    : []),
];

export const createNativeRenderer =
  (validation: NativeValidation = createNativeValidation()): NativeRenderer =>
  (input) => {
    const invalidTarget = targetFindings(input);
    if (invalidTarget.length > 0) return { status: "invalid", findings: invalidTarget };
    const rendered = input.target.render(input.document);
    if (rendered.status === "invalid") return rendered;
    const findings = resourceFindings({
      document: input.document,
      resources: rendered.value,
      validation,
    });
    if (findings.length > 0) return { status: "invalid", findings };
    return rendered;
  };

export const resourceKey = (resource: Pick<NativeResource, "kind" | "path">): string =>
  `${resource.kind}:${resource.path}`;

export const renderNativeResources = createNativeRenderer();
