# GitHub bot identities for Rin consumers

Rin's `guard-github-writes` hook blocks raw `gh` writes in agent sessions, because they would act as the operator's own GitHub login. The plugin ships the replacement: a bot CLI at `<harness-dir>/tools/github-apps/cli-main.ts`. Agent sessions act on the consumer's repository as two GitHub Apps that you register yourself, one per role.

## Which identity does what

The CLI uses up to three credentials. The first two are required; the third is needed only for file attachments.

| Credential           | What it is                                                              | Who GitHub shows                 | Used for                                                                                                  | Required                     |
| -------------------- | ----------------------------------------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Author app           | a GitHub App you register, installed on the consumer repository         | `<author-app-slug>[bot]`         | `gh pr create/edit/comment/ready/merge/close`, `gh issue create/edit/comment/close/reopen`, `git push`    | yes                          |
| Reviewer app         | a second GitHub App you register, installed on the same repository      | `<reviewer-app-slug>[bot]`       | `gh pr review`                                                                                            | yes                          |
| Operator OAuth grant | a grant from a GitHub account to an OAuth app you register, per machine | the account that gave the grant  | a write that carries `--attach`, and nothing else                                                         | no, only for `--attach`      |

GitHub refuses a bot's approval of its own pull request. Splitting authoring from reviewing across two apps is what lets an agent review count.

Without the operator grant, every write that carries no `--attach` works as usual. A write with `--attach` then fails before anything is posted, with `No user grant at <path>, and attachments are never uploaded under another identity.` The CLI never falls back to a bot token or to your own `gh` login.

## What is fixed and what is yours

The CLI fixes these names. Use them exactly:

- the role names `author` and `reviewer`, as the keys in both `credentials.json` and `aidlc/github-identity.json`;
- the provenance marker, `<!-- rin-bot: role=<role> session=<id> -->`;
- the store directory, `~/.config/rin-github-apps` unless `RIN_GITHUB_APPS_CREDENTIALS_DIR` names another, and the files the CLI reads or writes in it: `credentials.json`, `author.user-grant.json` and `author.user-grant.lock`, plus two kinds of short-lived file it removes itself, `author.user-grant.json.<id>.tmp` while a grant is being written and `author.user-grant.lock.<id>.claimed` while a lock is being released or taken over;
- the consumer's configuration file, `aidlc/github-identity.json`.

Everything else is yours to choose: the two app slugs, their app IDs, the private key file names, the repository, and the OAuth app with its client ID. This guide writes them as placeholders such as `<author-app-slug>`. Where an example shows `rin-author` or `rin-reviewer`, those are one operator's app names (Helen's consumers use them), not names the CLI expects.

## Commands

Run every command from the consumer's project root. The examples use Claude's `.claude`; substitute the harness directory you installed.

Writes are the real `gh` command, prefixed with the CLI and `gh`:

```bash
bun .claude/tools/github-apps/cli-main.ts gh pr create --title "T" --body-file body.md --label bug
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

Every body an agent posts starts with the hidden marker, so authorship can be audited and filtered. The session is `--session <id>` when given (the wrapper takes it out before calling `gh`), otherwise the issue or pull request number after the verb, otherwise the `--head` branch, otherwise `new-issue` for `gh issue create`, otherwise the current branch. Text that contains a private key or a GitHub token (`gho_`, `ghu_`, `ghr_`, `ghs_`, `ghp_` or `github_pat_` followed by the token itself) is refused, whether given with `--body`, on standard input or in a `--body-file`. A `--body-file` or `--attach` file inside the credential store is refused; for `--attach`, every reading of a `#` in the value as the end of the path is checked, so alt text cannot hide one.

A consumer that prefers short names can add its own `package.json` scripts that call the CLI, for example `"gh:bot": "bun .claude/tools/github-apps/cli-main.ts gh"`. The hook's hints always name the CLI itself, so they never point at a script the consumer lacks.

## Attachments

GitHub accepts file uploads only from a person signed in through an OAuth app. It refuses them from a GitHub App, whether the app acts as itself or on a person's behalf. So `--attach` cannot ride a bot token. The wrapper uses a second credential for it and for nothing else: a grant from a GitHub account to an OAuth app of your own, obtained once per machine with `login`.

| Write with `--attach`                                              | What runs                                                                                                                             | Who GitHub shows                                            |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `gh pr create`, `gh issue create`                                  | the author bot creates it without the files, then the grant runs `gh pr edit <n>` or `gh issue edit <n>` with the same text and the files | the bot as author; the granting account as the last editor |
| `gh pr edit`, `gh issue edit`, `gh pr comment`, `gh issue comment` | the whole write runs under the grant                                                                                                  | the granting account                                        |
| any other wrapped write                                            | refused: it takes no `--attach`                                                                                                       | nobody                                                      |

Every other write, and every `git push`, `gh pr merge` and `gh pr review`, stays on the bots. No command prints the grant's token. A body written under the grant carries `via=user-grant` in its marker: `<!-- rin-bot: role=author session=<id> via=user-grant -->`. On a create, the bot's own step posts the plain marker and the follow-up edit replaces it with the `via=user-grant` one, so a create whose files failed to upload keeps the marker of the credential that wrote it.

The grant is not limited to one repository, so a write that runs under it must name its target by number. `gh pr edit`, `gh pr comment`, `gh issue edit` and `gh issue comment` with `--attach` are refused before anything runs when the argument after the verb is a URL, a branch or missing, and when any other argument contains a URL, because `gh` takes the repository from a URL and ignores `--repo`. That covers a second issue on `gh issue edit` and the values of `--parent`, `--add-sub-issue`, `--add-blocked-by` and their siblings; give those as numbers. A URL inside `--body` or a body file is text, not an argument, and is kept. A URL in `--title` is refused on these writes; put it in the body. `gh pr create --dry-run` and `gh issue create --dry-run` take no `--attach`, since nothing is created to attach to.

A create with `--attach` prints the created URL once. If the files then fail to upload, the pull request or issue still exists as the bot's, the wrapper says the attachments are incomplete, and it exits with the failing step's exit code. If the grant is missing, malformed or past its six months, nothing is created or posted and the message says to run `login`. A revoked grant is different: the CLI learns of a revocation only when it next refreshes, up to eight hours later. Until then a create still happens as the bot and its follow-up edit fails, and an edit or comment fails, each with `gh`'s own error. Whenever a step under the grant exits non-zero the wrapper adds `This step ran under the operator's grant. If gh reported bad credentials, the grant was revoked: run the "login" command of the bot CLI, then retry.`

### Whose account the grant belongs to

The grant belongs to whichever GitHub account approves the device code during `login`. Attachment writes are shown as that account. There are two ways to choose it:

- **Approve as yourself.** Attached comments and edits appear under your own login. This is the route this project has exercised live.
- **Approve as a dedicated machine account** that is a collaborator only on the consumer repositories. The `repo` scope then reaches only what that account can reach. This route has not been exercised by this project.

One grant in the per-user store serves every consumer repository on that machine. Each machine needs its own `login`.

### Switching attachments on

1. Register an OAuth app under the account that owns your apps: *Settings*, *Developer settings*, *OAuth Apps*, *New OAuth App*. The form requires a homepage URL and an authorization callback URL. Device flow never calls the callback, so any value works; `http://127.0.0.1` is a safe choice for both.
2. On the app's page, tick *Enable Device Flow*, and leave the app issuing expiring user access tokens (the box is labelled *Expire user access tokens* where the page shows it). Do not generate a client secret; the CLI never uses one.
3. Copy the app's **Client ID**. It is not a secret.
4. Add the client ID and the scope to the author entry of `credentials.json`, as [Credentials](#credentials) shows. The scope `repo` is what this project has tested.
5. Run `bun .claude/tools/github-apps/cli-main.ts login` from a consumer's project root. It prints a short code and `https://github.com/login/device` on standard error. Sign in to GitHub as the account that should hold the grant, enter the code and approve within the time the message gives. The command waits, then prints `The author role may now upload attachments as you from this machine.` with the date the grant stops renewing itself.

The app must issue expiring access tokens together with a refresh token. If it does not, `login` fails after you approve with `GitHub's reply to redeem the device code was not the expected shape:` followed by the missing fields, and stores nothing.

## Bring your own bot identities

Do this once per GitHub account or organisation that owns the apps. It ends with a check you can run.

1. **Register the author app.** Under the owning account, open *Settings*, *Developer settings*, *GitHub Apps*, *New GitHub App*. Give it a name; GitHub derives the app's slug from the name. Untick *Active* under *Webhook*: the CLI needs no webhook. Set repository permissions **Contents: read and write** (push and merge), **Pull requests: read and write** and **Issues: read and write** (comments, and opening, relabelling and closing issues), plus **Workflows: read and write** if agents change `.github/workflows/`. **Metadata: read** is always granted.
2. **Register the reviewer app** the same way, with **Pull requests: read and write** and **Contents: read**. It must be a separate app, because GitHub refuses an app's approval of a pull request that the same app opened.
3. **Note each app's ID and slug.** The **App ID** is on the app's settings page. The slug is the last part of the app's public page, `https://github.com/apps/<slug>`, and the `<slug>` in the `<slug>[bot]` login GitHub shows.
4. **Generate a private key for each app** (*Private keys*, *Generate a private key*). GitHub downloads a `.pem` file. Each key exists nowhere else, so keep the file.
5. **Create the per-user store.** Make the directory `~/.config/rin-github-apps`, move both `.pem` files into it, and write `credentials.json` there as [Credentials](#credentials) shows, with each role's app ID and key file name.
6. **Install both apps on a consumer repository and commit its configuration**, as [Setting up a consumer repository](#setting-up-a-consumer-repository) describes. The `appSlug` values there must be the slugs from step 3: minting refuses credentials that authenticate as a different app.
7. **Check it.** From the consumer's project root, run each of these. The token goes to standard output, so discard it; the confirmation is on standard error.

   ```bash
   bun .claude/tools/github-apps/cli-main.ts token --role author > /dev/null
   ```

   ```bash
   bun .claude/tools/github-apps/cli-main.ts token --role reviewer > /dev/null
   ```

   Success is `Minted a author installation token for <owner>/<repo>; it expires within an hour.` and the same line for `reviewer`. Then, in a linked worktree of the consumer (not its primary checkout), run:

   ```bash
   bun .claude/tools/github-apps/cli-main.ts adopt-git
   ```

   Success is `This worktree now commits and pushes as <author-app-slug>[bot]; plain git commit and git push use the bot.` In the primary checkout the same command prints `Left the primary checkout alone: it keeps its owner's git identity.` and changes nothing.

If a check fails, [Troubleshooting](#troubleshooting) maps the message to its fix.

## Configuration

Each consumer commits `aidlc/github-identity.json`:

```json
{
  "repository": "<owner>/<repo>",
  "baseBranch": "main",
  "roles": {
    "author": { "appSlug": "<author-app-slug>" },
    "reviewer": { "appSlug": "<reviewer-app-slug>" }
  }
}
```

A token is always scoped to that one repository. `gh issue create`, `gh issue edit`, `gh issue close` and `gh issue reopen` narrow it further to **Issues: write**, and `gh pr comment` and `gh issue comment` to **Issues: write** and **Pull requests: write**. Minting refuses credentials that authenticate as a different app slug. Without this file the bot identity is unconfigured: the hook still blocks raw `gh` writes but says what to add, and worktree provisioning skips identity adoption without a message.

## Credentials

Nothing secret lives in any repository. The CLI reads one per-user credential store at `~/.config/rin-github-apps/credentials.json`. Set `RIN_GITHUB_APPS_CREDENTIALS_DIR` to an absolute path to use another directory; a relative one is refused, because git runs the credential helper from each worktree.

```json
{
  "author": { "appId": "<author app id>", "privateKeyPath": "<author-app-slug>.private-key.pem" },
  "reviewer": { "appId": "<reviewer app id>", "privateKeyPath": "<absolute path to the reviewer app's .pem>" }
}
```

`appId` may be a string of digits or a number. A relative `privateKeyPath` is read from the store directory; an absolute one is read where it points. Each private key therefore exists once per machine, and one rotation covers every consumer. The CLI ignores any other keys in an entry.

The author entry may also name the OAuth app that carries attachment uploads:

```json
{
  "author": {
    "appId": "<author app id>",
    "privateKeyPath": "<author-app-slug>.private-key.pem",
    "userAuthorisation": { "clientId": "<oauth app client id>", "scope": "repo" }
  }
}
```

`userAuthorisation` needs both `clientId` and `scope`. An entry with only one of them makes the whole file malformed, which stops bot tokens too. A role without `userAuthorisation` cannot upload attachments, and only the author role uses one. `login` writes the grant to `author.user-grant.json` in the store directory, owner-only where the file system enforces it; on Windows that protection is the user profile's own access control.

**This grant is broader than the bot tokens.** A bot token reaches one repository with the app's permissions. The `repo` scope reaches every repository the granting account can reach, with that account's own rights. Three things contain it: a run that uses it names its target by number and carries no URL, so the `--repo` the wrapper pins is the only repository `gh` can act on; it is used only for a write that carries `--attach`; and the file never leaves the credential store. A dedicated machine account narrows it further, as [Attachments](#whose-account-the-grant-belongs-to) describes. Treat `author.user-grant.json` like a password. To cut it off, revoke the OAuth app's access under *Settings*, *Applications*, *Authorized OAuth Apps* on the granting account.

The grant holds an access token that lasts eight hours and a refresh token that lasts about six months. The CLI reuses the access token until five minutes before it expires, then refreshes it. GitHub cancels the old pair on every refresh, so sessions running in parallel take a lock file, `author.user-grant.lock`, beside the grant, and read the grant again once they hold it; only one of them refreshes. A lock left behind by a session that died is taken over after two minutes, and a waiting session gives up after two and a half. A refreshed grant is written up to five times before the CLI gives up; if it still cannot be written the write fails with `Cannot write the user grant to ...` and `login` must be run again, because GitHub has already cancelled the pair on disk. After six months without a refresh, or after a revocation, run `login` again.

## Worktree git identity

On a new linked worktree, the plugin's `provision-worktree` hook runs `adopt-git`. Adoption first checks that the worktree's push remote is `https://github.com/<owner>/<repo>` for the configured repository, then mints an author token for it. If the worktree pushes somewhere else, pushes over SSH (the credential helper only serves HTTPS), the app is not installed there, or its credentials do not resolve, the worktree keeps its own git identity and the hook prints one line saying so; `git push` keeps working under the operator's normal credentials. Once adoption succeeds, the worktree's own git config commits as `<author-app-slug>[bot]` and pushes through a credential helper that mints a fresh token each time. The primary checkout is never changed.

## Setting up a consumer repository

1. Install each app on the consumer repository: on the app's settings page choose *Install App*, then the owning account, then *Only select repositories*, and add the repository. An installation inherits the app's permissions; it does not choose its own. The permissions each app needs are listed under [Bring your own bot identities](#bring-your-own-bot-identities).
2. Configure the base branch's ruleset to require a pull request with at least one approval, to require its status checks, to allow only squash merges, to dismiss stale approvals when new commits are pushed, and to require approval of the most recent push. `gh pr merge` through the wrapper does not judge reviews or merge state itself: the ruleset is the merge gate, and without it nothing stops a merge. The reviewer bot's approval satisfies the approval rule, and GitHub never lets the author bot approve its own pull request. If the rule restricts who may push or merge to the branch, add the author app to that list, and do not add either app to the bypass list.
3. Commit `aidlc/github-identity.json`.
4. Make sure the per-user credential store holds both roles.

## Troubleshooting

| Message starts                                                                 | Cause                                                                              | Fix                                                                                                                  |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `No bot identity is configured: cannot read ...`                               | the consumer has no `aidlc/github-identity.json`                                   | commit one, as [Configuration](#configuration) shows                                                                 |
| `No bot credentials at ...`                                                    | the store directory or its `credentials.json` is missing                           | create the store, or point `RIN_GITHUB_APPS_CREDENTIALS_DIR` at it with an absolute path                             |
| `Bot credentials at ... are malformed`                                         | `credentials.json` is not the shape [Credentials](#credentials) shows              | fix the entry the message names; a half-filled `userAuthorisation` is a common cause                                 |
| `The credential store at ... has no entry for the <role> role.`                | `credentials.json` lacks the `author` or `reviewer` key                            | add the entry, using the fixed role name                                                                             |
| `Cannot read the <role> app's private key at ...`                              | `privateKeyPath` points at a file that is not there                                | move the `.pem` into the store, or correct the path                                                                  |
| `The <role> credentials authenticate as <actual>, not <expected>.`             | the app ID and key belong to a different app than `appSlug` names                  | make `appSlug` in `aidlc/github-identity.json` the slug of the app whose ID and key are in the store, or swap them   |
| `The GitHub App is not installed on <owner>/<repo>; install it there first.`   | the role's app has no installation on the configured repository                    | install it on that repository                                                                                        |
| `The author entry in ... has no userAuthorisation.clientId`                    | `login` was run without an OAuth app configured                                    | add `userAuthorisation`, as [Credentials](#credentials) shows                                                        |
| `The OAuth app has device flow switched off.`                                  | *Enable Device Flow* is not ticked                                                 | tick it on the OAuth app's page, then run `login` again                                                              |
| `GitHub does not recognise the userAuthorisation.clientId ...`                 | the client ID is mistyped or belongs to no OAuth app; GitHub answers it with a 404 | copy the client ID from the OAuth app's page into `credentials.json`                                                 |
| `The login code expired before it was approved.`                               | the code was not entered within the time `login` gave                              | run `login` again                                                                                                    |
| `The login was declined on GitHub; nothing was stored.`                        | *Cancel* was chosen on the approval page                                           | run `login` again and approve                                                                                        |
| `GitHub's reply to redeem the device code was not the expected shape: ...`     | the OAuth app issues tokens that do not expire, so no refresh token came back      | switch on expiring user access tokens for the app, then run `login` again                                            |
| `No user grant at ...`                                                         | a write carried `--attach` on a machine where `login` has not run                  | run `login`; if attachments are not set up, drop `--attach`                                                          |
| `This machine's user grant has expired.`                                       | the refresh token ran out, about six months after the last refresh                 | run `login`                                                                                                          |
| `GitHub no longer accepts this machine's user grant`                           | the grant was revoked, or replaced by a refresh this machine did not record        | run `login`                                                                                                          |
| `The user grant at ... is malformed`                                           | `author.user-grant.json` was edited or cut short                                   | run `login`; it replaces the file                                                                                    |
| `Cannot write the user grant to ...`                                           | the store directory is read-only, or another program held the file through five tries | fix the directory's access, then run `login`: a refresh that could not be saved leaves the stored grant cancelled |
| `Another session has held the user grant lock at ... for too long.`            | a session has held `author.user-grant.lock` for two and a half minutes             | retry; if it persists, delete the lock file the message names                                                        |
| `Cannot create the user grant lock at ...`                                     | the store directory is missing or cannot be written                                | create the directory or fix its access; nobody else holds the lock                                                   |
| `gh <verb> with --attach needs the number right after the verb`                | a write under the grant named its target by URL or branch, or named none           | give the pull request or issue number                                                                                |
| `Refusing "..." on a write with --attach`                                      | an argument other than the body contains a URL                                     | give numbers in place of URLs; move a URL that is text into the body                                                 |
| `--dry-run creates nothing, so there is nothing to attach files to.`           | a create carried both `--dry-run` and `--attach`                                   | drop one of them                                                                                                     |
| `This step ran under the operator's grant. If gh reported bad credentials ...` | a step under the grant exited non-zero; if `gh` printed a 401, the grant was revoked | read `gh`'s error above it; for a 401 run `login`, otherwise fix what `gh` names                                   |
