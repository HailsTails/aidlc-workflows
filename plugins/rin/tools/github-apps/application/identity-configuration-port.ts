import type { AgentRole } from "../domain/agent-role.ts";
import type { RepositorySlug } from "../domain/repository-slug.ts";
import type { Result } from "../domain/result.ts";

type RoleApp = { readonly appSlug: string };

type IdentityConfiguration = {
  readonly repository: RepositorySlug;
  readonly baseBranch: string;
  readonly roles: { readonly [Role in AgentRole]: RoleApp };
};

type ConfigurationFailure =
  | { readonly kind: "configuration-unreadable"; readonly location: string }
  | { readonly kind: "configuration-invalid"; readonly location: string; readonly issues: string };

type IdentityConfigurationLoader = () => Promise<
  Result<IdentityConfiguration, ConfigurationFailure>
>;

export type { ConfigurationFailure, IdentityConfiguration, IdentityConfigurationLoader };
