import type { AgentRole } from "../domain/agent-role.ts";
import type { Result } from "../domain/result.ts";
import type { Secret } from "../domain/secret.ts";

type RoleCredentials = { readonly appId: string; readonly privateKey: Secret };

type CredentialFailure =
  | { readonly kind: "credential-store-unlocatable"; readonly detail: string }
  | { readonly kind: "credentials-unreadable"; readonly path: string }
  | { readonly kind: "credentials-invalid"; readonly path: string; readonly issues: string }
  | { readonly kind: "role-credentials-missing"; readonly role: AgentRole; readonly path: string }
  | { readonly kind: "private-key-unreadable"; readonly role: AgentRole; readonly path: string };

type CredentialRequest = { readonly role: AgentRole };

type UserAuthorisationSettings = { readonly clientId: string };

type UserAuthorisationUnconfigured = {
  readonly kind: "user-authorisation-unconfigured";
  readonly role: AgentRole;
  readonly path: string;
};

type StoreLocator = () => Result<string, { readonly detail: string }>;

type CredentialStorePort = {
  readonly loadRoleCredentials: (
    request: CredentialRequest,
  ) => Promise<Result<RoleCredentials, CredentialFailure>>;
};

type UserAuthorisationSettingsPort = {
  readonly loadUserAuthorisationSettings: (
    request: CredentialRequest,
  ) => Promise<Result<UserAuthorisationSettings, CredentialFailure | UserAuthorisationUnconfigured>>;
};

export type {
  CredentialFailure,
  CredentialRequest,
  CredentialStorePort,
  RoleCredentials,
  StoreLocator,
  UserAuthorisationSettings,
  UserAuthorisationSettingsPort,
  UserAuthorisationUnconfigured,
};
