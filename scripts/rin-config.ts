import { rinConfigCommand } from "../plugins/rin/tools/rin-config.ts";

export const runRinConfig = (input: string[]): Promise<void> => rinConfigCommand.configure({ input });
if (import.meta.main) await runRinConfig(process.argv.slice(2));
