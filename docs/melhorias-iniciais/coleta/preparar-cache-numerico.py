"""Alternative bounded storage without allocating string keys for each query."""
from pathlib import Path
import shutil,subprocess

root=Path(__file__).parent
repo=root/'experimentos/cache-numerico'
assert not repo.exists()
shutil.copytree(root/'experimentos/cache',repo,ignore=shutil.ignore_patterns('resultados'))
file=repo/'src/mundo/caminhos.js';source=file.read_text()
start=source.index(' // Exact samples are private');end=source.index(' const clip=',start)
helper=''' // Fixed storage avoids temporary string keys. Hash collisions only evict an
 // entry: both original coordinates must match exactly before a value is reused.
 const fieldCache={
  x:new Float64Array(4096),z:new Float64Array(4096),value:new Float64Array(4096),
  valid:new Uint8Array(4096),point:new Float64Array(2),
  clear(){this.valid.fill(0)}
 };
 const pointBits=new Uint32Array(fieldCache.point.buffer);
 const sampleWalkField=(x,z)=>{
  fieldCache.point[0]=x;fieldCache.point[1]=z;
  const slot=(Math.imul(pointBits[0]^pointBits[1],0x9e3779b1)^Math.imul(pointBits[2]^pointBits[3],0x85ebca6b))>>>20;
  if(fieldCache.valid[slot]&&fieldCache.x[slot]===x&&fieldCache.z[slot]===z)return fieldCache.value[slot];
  const value=walkFieldAt(x,z);
  fieldCache.x[slot]=x;fieldCache.z[slot]=z;fieldCache.value[slot]=value;fieldCache.valid[slot]=1;
  return value;
 };
'''
source=source[:start]+helper+source[end:]
needle=' } finally {\n  fieldCache.clear();\n }'
assert source.count(needle)==1
source=source.replace(needle,' } finally {\n  fieldCache.clear();\n  fieldCache.x.fill(0);fieldCache.z.fill(0);fieldCache.value.fill(0);fieldCache.point.fill(0);\n }')
file.write_text(source)
doc=repo/'docs/CARREGAMENTO.md'
doc.write_text(doc.read_text().replace('é esvaziado a cada linha da malha e também','usa armazenamento numérico fixo para 4.096 consultas, é invalidado a cada linha da malha e é limpo também')+'\nO índice de hash não arredonda as coordenadas: uma entrada só é reutilizada quando ambas coincidem exatamente. Colisões substituem entradas e podem causar recálculo, sem alterar os valores. Os buffers privados somam 102.416 bytes e são zerados ao terminar, cancelar ou falhar.\n')
subprocess.run(['node','scripts/gerar.mjs'],cwd=repo,check=True)
