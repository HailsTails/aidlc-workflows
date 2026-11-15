# GitHub bot identities for Rin consumers

Rin's `guard-github-writes` hook blocks raw `gh` writes in agent sessions, because they would act as the operator's own GitHub login. The plugin ships the replacement: a bot CLI at `<harness-dir>/tools/github-apps/cli-main.ts`. Agent sessions act on the consumer's repository as two GitHub Apps:

| Role       | Actor                  | Used by           | Writes                                                                                              |
| ---------- | ---------------------- | ----------------- | --------------------------------------------------------------------------------------------------- |
| `author`   | `<author-slug>[bot]`   | author sessions   | `gh pr create/edit/comment/ready/merge/close`, `gh issue create/edit/comment/close/reopen`, `git push` |
| `reviewer` | `<reviewer-slug>[bot]` | reviewer sessions | `gh pr review`                                                                                      |

GitHub refuses a bot's approval of its own pull request. Splitting authoring from reviewing across two apps is what lets an agent review count. Helen's consumers use the `rin-author` and `rin-reviewer` apps.

## Commands

Run every command from the consumer's project root. The examples use Claude's `.claude`; substitute the harness directory you installed.

Writes are the real `gh` command, prefixed with the CLI and `gh`:

```bash
bun .claude/tools/github-apps/cli-main.ts gh pr create --title "T" --body-file body.md --label bug --attach shot.png#Before
```

The wrapper mints the role's bot token, sets `GH_TOKEN` and `GH_PROMPT_DISABLED=1`, pins `--repo` to the configured repository, stamps the provenance marker onto the body, and runs `gh` (2.103.2 or later; earlier releases cannot use an app installation token). Every other argument, including `--label`, `--add-label`, `--squash` and `--auto`, goes to `gh` unchanged. `--attach` is the one exception: GitHub refuses file uploads from an app, so a write that carries `--attach` uses the operator's grant instead, as [Attachments](#attachments) describes. The wrapper prints what `gh` printed and exits with `gh`'s exit code, so a write that publishes and then fails an upload still prints the URL it published. Reads (`gh pr view`, `gh pr list`, `gh pr checks`, `gh api` GETs) stay plain `gh`.

| Wrapped write                                                                 | Notes                                                                                                   |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `gh pr create`, `gh issue create`, `gh pr comment`, `gh issue comment`        | need a body (`--body`, `--body-file`, or `--body-file -` for standard input) or at least one `--attach` |
| `gh pr edit`, `gh issue edit`                                                 | stamp the body only when one is given                                                                   |
| `gh pr ready`, `gh pr merge`, `gh issue close`, `gh issue reopen`             | pass through; a `gh pr merge --body` is passed on unstamped, as the commit body                         |
| `gh pr close <n> [--comment "C"]`                                             | refuses a pull request that is approved and mergeable; the closing comment is stamped                   |
| `gh pr review <n> --approve\|--request-changes\|--comment [--body "B"] [--commit-sha <sha>]` | runs as the reviewer bot and posts against the head it read, refusing if `--commit-sha` names another head |
| `... adopt-git`                                                               | makes this linked worktree commit and push as the author bot                                            |
| `... token --role author\|reviewer`                                           | prints a one-hour installation token, for `GH_TOKEN=` use outside the wrapped writes                    |
| `... marker --role author\|reviewer --session <id>`                           | prints the provenance marker                                                                            |
| `... login`                                                                   | stores the operator's grant for attachment uploads on this machine; see [Attachments](#attachments)     |

`gh pr close` and `gh pr review` take the pull request number right after the verb, because the wrapper reads that pull request before it acts. `gh pr review` through the wrapper takes only the number, one event flag, a body and `--commit-sha`.

The wrapper refuses `--repo`/`-R` (the repository is pinned), `--admin` (it never bypasses rulesets), `--web`, `--editor`, `--fill`, `--fill-first`, `--fill-verbose`, `--template` and `--recover` (the body would not be one it stamped). `--body` and `--body-file` cannot both be given.

Every body an agent posts starts with a hidden marker, `<!-- rin-bot: role=<role> session=<id> -->`, so authorship can be audited and filtered. The session is `--session <id>` when given (the wrapper takes it out before calling `gh`), otherwise the issue or pull request number after the verb, otherwise the `--head` branch, otherwise `new-issue` for `gh issue create`, otherwise the current branch. Text that contains a private key or a GitHub OAuth token (`gho_`, `ghu_` or `ghr_` followed by the token itself) is refused, whether given with `--body`, on standard input or in a `--body-file`. A `--body-file` or `--attach` file inside the credential store is refused; for `--attach`, every reading of a `#` in the value as the end of the path is checked, so alt text cannot hide one.

A consumer that prefers short names can add its own `package.json` scripts that call the CLI, for example `"gh:bot": "bun .claude/tools/github-apps/cli-main.ts gh"`. The hook's hints always name the CLI itself, so they never point at a script the consumer lacks.

## Attachments

GitHub accepts file uploads only from a person signed in through an OAuth app. It refuses them from a GitHub App, whether the app acts as itself or on a person's behalf. So `--attach` cannot ride the bot token. The wrapper uses a second credential for it and for nothing else: a grant from the operator to a small OAuth app of their own, obtained once per machine with `login`.

| Write with `--attach`                                              | What runs                                                                                                                      | Who GitHub shows                                   |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| `gh pr create`, `gh issue create`                                  | the bot creates it without the files, then the operator's grant runs `gh pr edit <n>` or `gh issue edit <n>` with the same body and the files | the bot as author; the operator as the last editor |
| `gh pr edit`, `gh issue edit`, `gh pr comment`, `gh issue comment` | the whole write runs under the operator's grant                                                                                | the operator, through the OAuth app                |
| any other wrapped write                                            | refused: it takes no `--attach`                                                                                                | nobody                                             |

Every other write, and every `git push`, `gh pr merge` and `gh pr review`, stays on the bot. No command prints the operator's token. A body posted with attachments carries `via=user-grant` in its marker: `<!-- rin-bot: role=author session=<id> via=user-grant -->`.

A create with `--attach` prints the created URL once. If the files then fail to upload, the pull request or issue still exists as the bot's, the wrapper says the attachments are incomplete, and it exits with the failing step's exit code. If the grant is missing, malformed, expired or revoked, nothing is created or posted and the message says to run `login`. The wrapper never falls back to the bot token or to the operator's own `gh` login.

To switch attachments on:

1. Create an OAuth app under your own account (*Settings*, *Developer settings*, *OAuth Apps*), and tick *Enable Device Flow*. Copy its **Client ID**; it is not a secret. No client secret is needed. The app must issue expiring access tokens with a refresh token: `login` rejects a reply without both expiries as malformed.
2. Add the client ID and the scope to the author entry of `credentials.json`, as [Credentials](#credentials) shows.
3. Run `bun .claude/tools/github-apps/cli-main.ts login` from a consumer's project root. It prints a short code and `https://github.com/login/device`. Enter the code there and approve within 15 minutes; the command waits, then stores the grant.

## Configuration

Each consumer commits `aidlc/github-identity.json`:

```json
{
  "repository": "HailsTails/minutesarah-shop",
  "baseBranch": "main",
  "roles": {
    "author": { "appSlug": "rin-author" },
    "reviewer": { "appSlug": "rin-reviewer" }
  }
}
```

A token is always scoped to that one repository. `gh issue create`, `gh issue edit`, `gh issue close` and `gh issue reopen` narrow it further to **Issues: write**, and `gh pr comment` and `gh issue comment` to **Issues: write** and **Pull requests: write**. Minting refuses credentials that authenticate as a different app slug. Without this file the bot identity is unconfigured: the hook still blocks raw `gh` writes but says what to add, and worktree provisioning skips identity adoption without a message.

## Credentials

Nothing secret lives in any repository. The CLI reads one per-user credential store at `~/.config/rin-github-apps/credentials.json`. Set `RIN_GITHUB_APPS_CREDENTIALS_DIR` to an absolute path to use another directory; a relative one is refused, because git runs the credential helper from each worktree.

```json
{
  "author": { "appId": "<id>", "privateKeyPath": "rin-author.private-key.pem" },
  "reviewer": { "appId": "<id>", "privateKeyPath": "<absolute path to rin-reviewer.private-key.pem>" }
}
```

A relative `privateKeyPath` is read from the store directory; an absolute one is read where it points. Each private key therefore exists once per machine, and one rotation covers every consumer.

The author entry may also name the OAuth app that carries attachment uploads:

```json
{
  "author": {
    "appId": "<id>",
    "privateKeyPath": "rin-author.private-key.pem",
    "userAuthorisation": { "clientId": "<oauth app client id>", "scope": "repo" }
  }
}
```

A role without `userAuthorisation` cannot upload attachments, and only the author role uses one. `login` writes the grant to `author.user-grant.json` in the store directory, owner-only where the file system enforces it; on Windows that protection is the user profile's own access control.

**This grant is broader than the bot tokens.** A bot token reaches one repository with the app's permissions. The `repo` scope reaches every repository the operator can reach, with the operator's own rights. Three things contain it: the wrapper pins `--repo` to the configured repository on every run that uses it, it is used only for a write that carries `--attach`, and the file never leaves the credential store. Treat `author.user-grant.json` like a password. To cut it off, revoke the OAuth app's access under *Settings*, *Applications*, *Authorized OAuth Apps*.

The grant holds an access token that lasts eight hours and a refresh token that lasts about six months. The CLI reuses the access token until five minutes before it expires, then refreshes it. GitHub cancels the old pair on every refresh, so sessions running in parallel take a lock file, `author.user-grant.lock`, beside the grant, and read the grant again once they hold it; only one of them refreshes. A lock left behind by a session that died is taken over after two minutes. After six months without a refresh, or after a revocation, run `login` again.

## Worktree git identity

On a new linked worktree, the plugin's `provision-worktree` hook runs `adopt-git`. Adoption first checks that the worktree's push remote is `https://github.com/<owner>/<repo>` for the configured repository, then mints an author token for it. If the worktree pushes somewhere else, pushes over SSH (the credential helper only serves HTTPS), the app is not installed there, or its credentials do not resolve, the worktree keeps its own git identity and the hook prints one line saying so; `git push` keeps working under the operator's normal credentials. Once adoption succeeds, the worktree's own git config commits as `<author-slug>[bot]` and pushes through a credential helper that mints a fresh token each time. The primary checkout is never changed.

## Setting up a consumer repository

1. Install each app on the consumer repository: on the app's settings page choose *Install App*, then the owning account, then *Only select repositories*, and add the repository. An installation inherits the app's permissions; it does not choose its own. Check that the author app has **Contents: read and write** (push and merge), **Pull requests: read and write** and **Issues: read and write** (comments, and opening, relabelling and closing issues), plus **Workflows: read and write** if agents change `.github/workflows/`. Check that the reviewer app has **Pull requests: read and write** and **Contents: read**. **Metadata: read** is always granted.
2. Configure the base branch's ruleset to require a pull request with at least one approval, to require its status checks, to allow only squash merges, to dismiss stale approvals when new commits are pushed, and to require approval of the most recent push. `gh pr merge` through the wrapper does not judge reviews or merge state itself: the ruleset is the merge gate, and without it nothing stops a merge. The reviewer bot's approval satisfies the approval rule, and GitHub never lets the author bot approve its own pull request. If the rule restricts who may push or merge to the branch, add the author app to that list, and do not add either app to the bypass list.
3. Commit `aidlc/github-identity.json`.
4. Make sure the per-user credential store holds both roles.
