type PermissionLevel = "read" | "write";

type PermissionScope = "issues" | "pull_requests";

type InstallationPermissions = { readonly [Scope in PermissionScope]?: PermissionLevel };

export type { InstallationPermissions, PermissionLevel, PermissionScope };
