import classAuthoringPlugin, {
	type ClassAuthoringPlugin,
} from "./cd14/plugin.ts";

export type Cd14EslintEntry = {
	readonly plugins: { readonly "rin-discipline": ClassAuthoringPlugin };
	readonly rules: { readonly "rin-discipline/no-class-authoring": "error" };
};
export const cd14EslintEntries: readonly Cd14EslintEntry[] = [
	{
		plugins: { "rin-discipline": classAuthoringPlugin },
		rules: { "rin-discipline/no-class-authoring": "error" },
	},
];
export default cd14EslintEntries;
