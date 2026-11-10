type RulesFolderRename = {
  readonly text: string;
  readonly harnessDir: string;
  readonly rulesFolder: string | null;
};

export const renameRulesFolder = ({ text, harnessDir, rulesFolder }: RulesFolderRename): string => {
  if (!rulesFolder) return text;
  const escapedDirectory = harnessDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`${escapedDirectory}/rules/(?!default\\.rules)`, "g"),
    `${harnessDir}/${rulesFolder}/`);
};
