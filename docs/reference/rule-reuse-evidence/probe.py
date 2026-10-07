import argparse,pathlib,tempfile,subprocess,json

def hermetic_environment(*,tools,config_home,bun,read=subprocess.check_output):
 module=tools/'hermetic-git/hermetic-git-environment.ts'
 code='import {hermeticGitEnvironment} from '+json.dumps(str(module))+'; console.log(JSON.stringify(hermeticGitEnvironment({configHome:'+json.dumps(str(config_home))+'})));'
 environment=json.loads(read([bun,'-e',code],text=True))
 if not isinstance(environment,dict) or not all(isinstance(key,str) and isinstance(value,str) for key,value in environment.items()):
  raise ValueError('hermetic Git environment must contain string entries')
 return environment

def fixture_command(*,args,root,environment,expected=0,runner=subprocess.run):
 outcome=runner(args,cwd=root,env=environment,text=True,capture_output=True)
 assert outcome.returncode==expected,(outcome.returncode,outcome.stderr)
 return outcome.stdout.strip()

def main(arguments=None):
 a=argparse.ArgumentParser();a.add_argument('mode',choices=['scope','cd46']);a.add_argument('--tools',type=pathlib.Path,required=True);a.add_argument('--consumer',type=pathlib.Path);a.add_argument('--bun',default='bun');v=a.parse_args(arguments);tools=v.tools.resolve()
 # Each probe owns an isolated temporary fixture; installed sources remain read-only.
 with tempfile.TemporaryDirectory(prefix='aidlc-rule-probe-') as tmp:
  root=pathlib.Path(tmp)
  config_home=root/'git-home';config_home.mkdir()
  env=hermetic_environment(tools=tools,config_home=config_home,bun=v.bun)
  def run(args,cwd=root,expected=0):
   return fixture_command(args=args,root=cwd,environment=env,expected=expected)
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
   def git(*args):return fixture_command(args=['git',*args],root=root,environment=env)
   git('init','-q');f=root/'src/utils.ts';f.parent.mkdir();f.write_text('export const fixture = 1;\n');git('add','src/utils.ts')
   git('-c','user.name=Acceptance Fixture','-c','user.email=fixture@example.invalid','commit','-qm','isolated fixture baseline')
   base=git('rev-parse','HEAD');side=root/'.constitution-carve-outs/cd-7.json';side.parent.mkdir()
   entries=[{'files':['src/utils.ts'],'reason':'Synthetic historical naming exception.','decision':'fixture-decision'}];side.write_text(json.dumps(entries))
   def decay(expected):
    return json.loads(fixture_command(args=[v.bun,str(tools/'rin-harness-carve-out-decay.ts'),'--project-dir',str(root),'--base-ref',base,'--json'],root=root,environment=env,expected=expected))
   untouched=decay(0);f.write_text('export const fixture = 2;\n');touched=decay(1)
   side.write_text('[]');retired=decay(0) # Filename still violates CD-7; no selected checker ran here.
   side.write_text(json.dumps(entries));f.write_text('export const fixture = 3;\n');blob=git('hash-object','-w','src/utils.ts')
   assert blob!=git('rev-parse',base+':src/utils.ts')
   known=decay(0) # Existing bug: loose object existence incorrectly exempts these changed bytes.
   print(json.dumps({'R7':False,'untouched':untouched,'touchedRetained':touched,'retiredWithoutPaydown':retired,'nonbaselineKnownBlob':known,'expectedCompleteContract':'last two cases must not establish CD-46 compliance'},indent=2))

if __name__ == "__main__":
 main()
