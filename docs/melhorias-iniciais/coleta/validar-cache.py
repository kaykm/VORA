import pathlib, subprocess, sys, json, hashlib

root=pathlib.Path(__file__).parent
variant=sys.argv[1] if len(sys.argv)>1 else 'cache'
out=root/'dados' if variant=='cache' else root/'dados'/variant
out.mkdir(exist_ok=True)
measure=root/'run-measure.py'
save=out/'synthetic-advanced.json'
source=pathlib.Path('/home/jp/Projects/Vora/docs/auditoria-testes-carregamento/dados/synthetic-advanced.json')
if not save.exists():save.write_bytes(source.read_bytes())
def run(label,repo,args):
 print('START',label,flush=True)
 subprocess.run([sys.executable,str(measure),str(repo),str(out),label,*args],check=True)
assert json.loads((root/'dados/testes-complete.json').read_text())['complete']
cache=root/'experimentos'/variant
run('cache-lifecycle',cache,['node','tests/caminhos-cache.test.mjs'])
for pair in range(5):
 for scenario in ['new','advanced']:
  values=[]
  for variant in (['testes','cache'] if pair%2==0 else ['cache','testes']):
   label=f'cache-par-{pair+1}-{scenario}-{variant}'
   repo=root/'experimentos/testes' if variant=='testes' else cache
   sample=out/(label+'-amostra.json')
   run(label,repo,['node',str(root/'medir-candidato.mjs'),str(repo),scenario,str(save),str(sample)])
   values.append(json.loads(sample.read_text()))
  assert values[0]['snapshot']==values[1]['snapshot'],(pair,scenario,'snapshot mismatch')
  assert values[0]['steps']==values[1]['steps'],(pair,scenario,'yield count mismatch')
for scenario in ['new','advanced']:
 values=[]
 for variant in ['testes','cache']:
  label=f'replay-{scenario}-{variant}'
  repo=root/'experimentos/testes' if variant=='testes' else cache
  sample=out/(label+'-amostra.json')
  run(label,repo,['node',str(root/'medir-candidato.mjs'),str(repo),scenario,str(save),str(sample),'replay'])
  values.append(json.loads(sample.read_text()))
 assert values[0]['snapshot']==values[1]['snapshot'],(scenario,'replay state mismatch')
 assert values[0]['frames']==values[1]['frames'],(scenario,'replay images mismatch')
run('suite-cache',cache,['node','scripts/verificar.mjs'])
(out/'cache-complete.json').write_text(json.dumps({'complete':True,'exitCode':0,'realBrowserMatrix':'pending; cache must not be incorporated'})+'\n')
