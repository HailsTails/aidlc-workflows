import argparse,pathlib,tempfile,subprocess,json,os
a=argparse.ArgumentParser();a.add_argument('mode',choices=['scope','cd46']);a.add_argument('--tools',type=pathlib.Path,required=True);a.add_argument('--consumer',type=pathlib.Path);a.add_argument('--bun',default='bun');v=a.parse_args();tools=v.tools.resolve()
# Each probe owns an isolated temporary fixture; installed sources remain read-only.
with tempfile.TemporaryDirectory(prefix='aidlc-rule-probe-') as tmp:
 root=pathlib.Path(tmp)
 def run(args,cwd=root,expected=0):
  p=subprocess.run(args,cwd=cwd,text=True,capture_output=True)
  assert p.returncode==expected,(p.returncode,p.stderr)
  return p.stdout
 if v.mode=='scope':
  assert v.consumer is not None
  consumer=v.consumer.resolve();graph=consumer/'.claude/tools/data/stage-graph.json'
  module=tools/'rin-harness-doc-discipline.ts';scopeModule=consumer/'.claude/tools/aidlc-graph.ts'
  code='import {resolvePlanForScope,subgraphForScope} from '+json.dumps(str(scopeModule))+'; console.log(JSON.stringify({plan:resolvePlanForScope("workshop"),nodes:subgraphForScope("workshop")}));'
  resolved=json.loads(run([v.bun,'-e',code],consumer));actions={n['slug']:n['action'] for n in resolved['plan']}
  assert actions['requirements-analysis']=='EXECUTE' and actions['intent-capture']=='SKIP'
  selectedGraph=root/'selected.json';selectedGraph.write_text(json.dumps(resolved['nodes']))
  record=root/'intents/probe';record.mkdir(parents=True)
  (record/'facts.md').write_text('| key | claim | value | re-derive | status | corrected-by |\n| --- | --- | --- | --- | --- | --- |\n| **MEASURE-1** | fixture count | 123 | read fixture | live | |\n')
  included=record/'inception/requirements-analysis/requirements.md';included.parent.mkdir(parents=True)
  excluded=record/'ideation/intent-capture/intent-statement.md';excluded.parent.mkdir(parents=True)
  included.write_text('# Requirements\n\nMEASURE-1 is used. INCLUDED-2 is undefined.\n')
  excluded.write_text('# Intent statement\n\nEXCLUDED-3 is undefined.\n')
  def inspect():
   code='import {inspectRecordDirectory} from '+json.dumps(str(module))+'; console.log(JSON.stringify({all:inspectRecordDirectory({recordDir:'+json.dumps(str(record))+',stageGraphPath:'+json.dumps(str(graph))+'}),selected:inspectRecordDirectory({recordDir:'+json.dumps(str(record))+',stageGraphPath:'+json.dumps(str(selectedGraph))+'})}));'
   return json.loads(run([v.bun,'-e',code],consumer))
  negative=inspect()
  assert {x['subject'] for x in negative['all']['findings']}=={'INCLUDED-2','EXCLUDED-3'}
  assert {x['subject'] for x in negative['selected']['findings']}=={'INCLUDED-2'}
  included.write_text('# Requirements\n\nMEASURE-1 is used.\n');corrected=inspect()
  assert corrected['selected']['findings']==[] and {x['subject'] for x in corrected['all']['findings']}=={'EXCLUDED-3'}
  print(json.dumps({'scope':'workshop','negative':negative,'corrected':corrected,'filteredGraphIsDiagnosticControlOnly':True},indent=2))
 else:
  env=dict(os.environ,GIT_CONFIG_GLOBAL='/dev/null',GIT_CONFIG_SYSTEM='/dev/null',GIT_TERMINAL_PROMPT='0')
  def git(*args):return subprocess.check_output(['git',*args],cwd=root,env=env,text=True).strip()
  git('init','-q');f=root/'src/utils.ts';f.parent.mkdir();f.write_text('export const fixture = 1;\n');git('add','src/utils.ts')
  git('-c','user.name=Acceptance Fixture','-c','user.email=fixture@example.invalid','commit','-qm','isolated fixture baseline')
  base=git('rev-parse','HEAD');side=root/'.constitution-carve-outs/cd-7.json';side.parent.mkdir()
  entries=[{'files':['src/utils.ts'],'reason':'Synthetic historical naming exception.','decision':'fixture-decision'}];side.write_text(json.dumps(entries))
  def decay(expected):
   p=subprocess.run([v.bun,str(tools/'rin-harness-carve-out-decay.ts'),'--project-dir',str(root),'--base-ref',base,'--json'],cwd=root,env=env,text=True,capture_output=True)
   assert p.returncode==expected,(p.returncode,p.stderr);return json.loads(p.stdout)
  untouched=decay(0);f.write_text('export const fixture = 2;\n');touched=decay(1)
  side.write_text('[]');retired=decay(0) # Filename still violates CD-7; no selected checker ran here.
  side.write_text(json.dumps(entries));f.write_text('export const fixture = 3;\n');blob=git('hash-object','-w','src/utils.ts')
  assert blob!=git('rev-parse',base+':src/utils.ts')
  known=decay(0) # Existing bug: loose object existence incorrectly exempts these changed bytes.
  print(json.dumps({'R7':False,'untouched':untouched,'touchedRetained':touched,'retiredWithoutPaydown':retired,'nonbaselineKnownBlob':known,'expectedCompleteContract':'last two cases must not establish CD-46 compliance'},indent=2))
