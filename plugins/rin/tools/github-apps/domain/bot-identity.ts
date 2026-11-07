type BotIdentity = { readonly login: string; readonly commitEmail: string };

type GitHubApp = { readonly appSlug: string };

const botIdentityFor = ({ appSlug }: GitHubApp): BotIdentity => ({
  login: `${appSlug}[bot]`,
  commitEmail: `${appSlug}[bot]@users.noreply.github.com`,
});

export { botIdentityFor, type BotIdentity, type GitHubApp };
