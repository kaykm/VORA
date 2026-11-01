from pathlib import Path
import difflib,hashlib,json,sys

root=Path(__file__).parent
target=Path(sys.argv[1]);target.mkdir(parents=True,exist_ok=True)
def make(name,before,after,files):
 changes=[]
 for file in files:
  original=(before/file).read_text() if (before/file).exists() else ''
  result=(after/file).read_text()
  changes.append(''.join(difflib.unified_diff(original.splitlines(True),result.splitlines(True),
   fromfile='a/'+file if (before/file).exists() else '/dev/null',tofile='b/'+file)))
 (target/name).write_text(''.join(changes))
base=root/'experimentos/baseline';tests=root/'experimentos/testes';cache=root/'experimentos/cache-numerico'
make('01-testes.patch',base,tests,['tests/piso-loja.test.mjs','tests/sombras.test.mjs','tests/carregamento.test.mjs'])
make('02-cache-caminhos-PENDENTE.patch',tests,cache,['src/mundo/caminhos.js','tests/carregamento.test.mjs','tests/caminhos-cache.test.mjs','tests/fixtures/caminhos.json','docs/CARREGAMENTO.md'])
hashes={name:hashlib.sha256((repo/'dist/VORA.html').read_bytes()).hexdigest() for name,repo in [('baseline',base),('testes',tests),('cache',cache)]}
(root/'dados/html-hashes.json').write_text(json.dumps(hashes,indent=2)+'\n')
print(hashes)
