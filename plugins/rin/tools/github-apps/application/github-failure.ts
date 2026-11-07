type GitHubFailure =
  | { readonly kind: "github-unreachable"; readonly operation: string }
  | {
      readonly kind: "github-rejected";
      readonly operation: string;
      readonly status: number;
      readonly detail: string;
    }
  | {
      readonly kind: "github-response-invalid";
      readonly operation: string;
      readonly issues: string;
    };

export type { GitHubFailure };
