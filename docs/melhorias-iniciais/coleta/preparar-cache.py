"""Create the unincorporated candidate in an isolated copy."""
from pathlib import Path
import json, subprocess

root=Path(__file__).parent
repo=root/'experimentos/cache'
file=repo/'src/mundo/caminhos.js'
source=(root/'experimentos/testes/src/mundo/caminhos.js').read_text()
start=source.index(' const clip=(poly,threshold,above)=>')
end=source.index(' walkMeshStats=',start)
body=source[start:end].replace('walkFieldAt(', 'sampleWalkField(')
loop=body.index(' for (let j=0; j<n; j++) for (let i=0; i<n; i++) {')
loopbody=body[loop:].replace('  if (++processedCells % 4 === 0)', '  if (i===0) fieldCache.clear();\n  if (++processedCells % 4 === 0)',1)
body=body[:loop]+' try {\n'+''.join(' '+line if line.strip() else line for line in loopbody.splitlines(True))+' } finally {\n  fieldCache.clear();\n }\n'
helper=''' // Exact samples are private to this construction and retained for one row.
 // No quantization: adjacent cells must produce the same Float32 geometry.
 const fieldCache=new Map();
 const sampleWalkField=(x,z)=>{
  const key=x+','+z;
  if(fieldCache.has(key))return fieldCache.get(key);
  const value=walkFieldAt(x,z);
  fieldCache.set(key,value);
  return value;
 };
'''
file.write_text(source[:start]+helper+body+source[end:])

data=Path('/home/jp/Projects/Vora/docs/auditoria-testes-carregamento/dados')
models=json.loads((data/'boot-prototypes.json').read_text())
baseline=next(row for row in models if row['name']=='baseline')['snapshot']
native=json.loads((data/'native-walk-validation.json').read_text())['results'][0]
native['ranges']=subprocess.check_output(['node','--input-type=module','-e',"import fs from 'node:fs';import {createHash} from 'node:crypto';process.stdout.write(createHash('sha256').update(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')))).digest('hex'))"],input=json.dumps(native['ranges']),text=True)
fixture={'sourceCommit':'f9fcbccdeaf4fc22f07862eb44f1c7c486926d22',
 'evidence':'Original audit baseline: boot-prototypes.json and native-walk-validation.json; unchanged source hashes.',
 'software':{'vertices':baseline['walkway'],'stats':baseline['walkwayStats']},
 'native':{key:value for key,value in native.items() if key!='name'}}
(repo/'tests/fixtures').mkdir(exist_ok=True)
(repo/'tests/fixtures/caminhos.json').write_text(json.dumps(fixture,indent=2)+'\n')
testfile=repo/'tests/carregamento.test.mjs'
text=(root/'experimentos/testes/tests/carregamento.test.mjs').read_text().replace("import path from 'node:path';", "import path from 'node:path';\nimport {createHash} from 'node:crypto';")
anchor=" assert.ok(game.storageWrites.length>0);"
assert text.count(anchor)==1
text=text.replace(anchor,anchor+'''

 // Reuse the completed boot: the geometry oracle predates the path cache.
 const expected=JSON.parse(read('tests/fixtures/caminhos.json')).software;
 const vertices=game.run('walkMesh.buffer.data');
 assert.equal(createHash('sha256').update(Buffer.from(vertices.buffer,vertices.byteOffset,vertices.byteLength)).digest('hex'),expected.vertices);
 assert.equal(createHash('sha256').update(JSON.stringify(game.json('walkMeshStats'))).digest('hex'),expected.stats);
''')
testfile.write_text(text)
print('Prepared isolated cache; original audit and workspace production source untouched.')
