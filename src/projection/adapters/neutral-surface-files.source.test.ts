import {expect,mock,test} from "bun:test";
import {accept} from "../../kernel/fixtures/accept.ts";
import {createNodeFileSystem} from "../../kernel/file-system.ts";
import {createBunContentDigester} from "../../kernel/content-digester.ts";
import {bindCwdDocuments} from "../domain/cwd-guidance.ts";
import {createNeutralReading} from "./neutral-surface-files.ts";
import {accepted} from "../../kernel/result.ts";
import type {SessionSkillTreeReader} from "../application/ports/skills.ts";

test.each([{channel:"copy" as const,expected:"sha256:4153ad41cd3b14ab6151c57c1ff009cb66a5d2919c7c6b8e90c41067eb3d828e"},{channel:"native" as const,expected:"sha256:043c660c19433011db5065f254ff3b220ab1d8fcceb74b9c3da54b92d30848ca"}])("shipped protocol author contract preserves complete $channel source bytes",async({channel,expected})=>{
 const fileSystem=createNodeFileSystem();
 const raw=accept(await fileSystem.readFile({file:new URL("../../../core/aidlc-common/protocols/stage-protocol.md",import.meta.url)}));
 const readTree=mock<SessionSkillTreeReader["readTree"]>().mockResolvedValue(accepted({files:[{path:"stage-protocol.md",content:raw}],unreadable:[]}));
 const surface=accept(await createNeutralReading({files:fileSystem,tree:{readTree}})({core:new URL("../../../core/",import.meta.url),sources:[],hookGuidance:"framework-hooks",toolsGuidance:"framework-tools",cwdGuidance:{kind:"framework-cwd",source:"aidlc-common/protocols/stage-protocol.md"}}));
 const documents=bindCwdDocuments({captured:surface.documents,channel});
 expect(documents[1]?.source).toBe("aidlc-common/protocols/stage-protocol.md");
 expect(createBunContentDigester().hash(documents[1]?.content??{kind:"text",text:"MISSING expected protocol"})).toEqual(accepted(expected));
 expect(surface.documents.documents[1]?.content).toEqual(raw);
 expect(readTree).toHaveBeenCalledTimes(1);
});
