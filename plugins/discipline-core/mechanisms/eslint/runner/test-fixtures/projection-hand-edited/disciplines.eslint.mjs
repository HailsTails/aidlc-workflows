import piece0 from "../../../CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  {
    name: "discipline-core/piece/rin-discipline-edited",
    files: ["**/*.{ts,tsx,mts,cts}"],
    plugins: { "rin-discipline": piece0 },
    rules: { "rin-discipline/no-class-authoring": "error" },
  },
];
