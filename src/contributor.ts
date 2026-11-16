import type { Git, Identity } from "./git.ts";

const BOT_MARKER = "[bot]";

export type Contributor = {
  readonly name: string;
  readonly email: string;
};

export const contributorFrom = (git: Git): Contributor => {
  const name = git.globalConfig("user.name");
  const email = git.globalConfig("user.email");
  if (name === undefined || email === undefined) {
    throw new Error("set the contributor's own identity first: git config --global user.name and user.email");
  }
  if (name.includes(BOT_MARKER) || email.includes(BOT_MARKER)) {
    throw new Error(`the global git identity ${name} <${email}> is a bot; the candidate needs the contributor's own`);
  }
  return { name, email };
};

export const signedBy = (contributor: Contributor, date: string): Identity => ({ ...contributor, date });
