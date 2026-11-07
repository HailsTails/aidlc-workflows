import piece0 from "../../../CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/discipline-edited",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "discipline": piece0 },
    rules: { "discipline/no-class-authoring": "error" },
  },
];
