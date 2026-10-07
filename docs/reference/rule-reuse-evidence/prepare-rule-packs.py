import argparse,json,pathlib,shutil
a=argparse.ArgumentParser();a.add_argument('--rin-plugin',type=pathlib.Path,required=True);a.add_argument('--out',type=pathlib.Path,required=True);v=a.parse_args()
assert not v.out.exists(), 'Use a fresh output directory; no replacement is performed.'
v.out.mkdir(parents=True)
binding=json.loads(pathlib.Path(__file__).with_name('results.json').read_text())
def manifest(name,contributes,deps):
 p=v.out/name/'.aidlc-plugin/plugin.json';p.parent.mkdir(parents=True)
 p.write_text(json.dumps({'name':name,'version':'0.1.0','description':'Local rule-boundary acceptance prototype; no workflow replacement.','author':{'name':'HailsTails'},'dependencies':deps,'aidlc':{'contributes':contributes}},indent=2)+'\n')
def copy(src,dst):
 dst.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(src,dst)
manifest('discipline-runtime',{'tools':'tools/'},['core'])
for rel in binding['closureFiles']:copy(v.rin_plugin/'tools'/rel,v.out/'discipline-runtime/tools'/rel)
shutil.copytree(v.rin_plugin/'tools/rin-runtime-types',v.out/'discipline-runtime/tools/rin-runtime-types')
for name in ['cd-7','dd-1']:
 manifest(name,{'knowledge':'knowledge/','sensors':'sensors/','tools':'tools/'},['core','discipline-runtime'])
 copy(v.rin_plugin/'tools'/('rin-harness-sensor-'+name+'.ts'),v.out/name/'tools'/('rin-harness-sensor-'+name+'.ts'))
 copy(v.rin_plugin/'sensors'/('aidlc-'+name+'.md'),v.out/name/'sensors'/('aidlc-'+name+'.md'))
 sensor=v.out/name/'sensors'/('aidlc-'+name+'.md')
 sensor.write_text(sensor.read_text().replace('bun .claude/tools/', 'bun {{HARNESS_DIR}}/tools/'))
rules={'cd-7':['code-discipline/cd-007-no-categorical-filenames.md'],'dd-1':['doc-discipline/dd-001-facts-are-keyed-rows.md','doc-discipline/dd-003-fact-keys-resolve-intent-wide.md','doc-discipline/dd-004-official-artefacts-only.md']}
for name,rels in rules.items():
 for rel in rels:copy(v.rin_plugin/'knowledge/aidlc-shared'/rel,v.out/name/'knowledge/aidlc-shared'/rel)
# Shipped declaration/license assets are retained. No dependency download is performed.
print(json.dumps({'created':['discipline-runtime','cd-7','dd-1'],'localPrototype':True}))
