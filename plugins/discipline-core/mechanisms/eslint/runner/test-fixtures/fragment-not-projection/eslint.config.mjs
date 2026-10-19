import plugin from "../../../CD-14/cd14/cd14.eslint-plugin.ts";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  {
    plugins: { "discipline": plugin },
    rules: { "discipline/no-class-authoring": "error" },
  },
];
