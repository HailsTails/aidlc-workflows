import { AIDLC_SETTINGS_SCHEMA } from "../../../core/tools/aidlc-settings.ts";
import type { FileContent } from "../../kernel/file-content.ts";

export const legacySettingsSchemaData = (): FileContent => ({
  kind: "text", text: `${JSON.stringify(AIDLC_SETTINGS_SCHEMA, null, 2)}\n`,
});
