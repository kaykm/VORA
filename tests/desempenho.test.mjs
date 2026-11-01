import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

const original=read('backup/VORA-original-17.html'), current=read('dist/VORA.html').replaceAll('initializeWorldResources();','').replaceAll('yield* initializeWorldResourcesIncremental();','');
const runPair=()=>[createRuntime(original),createRuntime(current)];

// The palette is allowed to change RGB only. Compare Float32 bits rather than
// approximate numbers so even a tiny shift in geometry or normals fails.
function assertSameGeometryAndFinish(actual,expected,label){
 assert.equal(actual.length,expected.length,label+' quantidade de vértices');
 const a=new Uint32Array(actual.buffer,actual.byteOffset,actual.length),b=new Uint32Array(expected.buffer,expected.byteOffset,expected.length);
 let changed=0;
 for(let i=0;i<actual.length;i+=9){
  for(let k=0;k<6;k++)assert.equal(a[i+k],b[i+k],label+' posição/normal '+(i+k));
  const finishA=Math.floor(actual[i+8]*.5+.001),finishB=Math.floor(expected[i+8]*.5+.001);
  assert.equal(finishA,finishB,label+' acabamento');
  for(let k=6;k<9;k++){
   const color=actual[i+k]-(k===8?finishA*2:0);
   assert.ok(Number.isFinite(color)&&color>=0&&color<=1,label+' cor válida');
   if(a[i+k]!==b[i+k])changed++;
  }
 }
 return changed;
}

test('índice de spawns equivale à busca completa e acompanha regeneração e acréscimos',()=>{
 const [before,after]=runPair();
 const probes=`(()=>{const result=[];for(let i=0;i<320;i++){
  const x=(materialHash(i,3.1)-.5)*4500,z=(materialHash(i,7.8)-.5)*4500;
  for(const group of Object.keys(SPAWN_GROUPS))result.push(spawnSlotAllowed(x,z,group));
 }return result})()`;
 assert.deepEqual(after.json(probes),before.json(probes));
 for(const g of [before,after])g.run(`environmentDetails.push({x:1600,z:1500,radius:95,kind:'shrub'});worldProps.push({type:'scenery',p:[-1500,1200,100],radius:140})`);
 assert.deepEqual(after.json(probes),before.json(probes));
 for(const g of [before,after])g.run('generate()');
 assert.deepEqual(after.json('({worldProps,environmentDetails})'),before.json('({worldProps,environmentDetails})'));
 assert.deepEqual(after.json(probes),before.json(probes));
 // Native rendering uses the denser planting branch. Its world must match too.
 for(const g of [before,after])g.run('gl.isSoftware=false;try{generate()}finally{gl.isSoftware=true}');
 assert.deepEqual(after.json('({worldProps,environmentDetails})'),before.json('({worldProps,environmentDetails})'));
});

test('vegetação e árvores preservam cada posição, normal e acabamento ao receber a nova paleta',()=>{
 const [before,after]=runPair();
 after.run('plantMeshes.clear();buildGroundDetails()');
 assert.equal(after.run('plantMeshes.size'),0,'a indexação de tiles não deve criar nenhum modelo detalhado');
 before.run('buildGroundDetails()');
 const tile='groundDetailsBatches.find(t=>t.plants.some(p=>isGroundCover(p.kind))&&t.plants.length>20).plants';
 let changedColors=0;
 for(const detail of [0,1]){
  const a=before.run(`bakePlantTile(${tile},${detail}).buffer.data`);
  const b=after.run(`bakePlantTile(${tile},${detail}).buffer.data`);
  changedColors+=assertSameGeometryAndFinish(b,a,'tile/LOD '+detail);
 }
 for(const detail of [0,1])for(let variant=0;variant<14;variant++){
  const expression=`makeTreeModel(${variant},${detail}).vertices`;
  changedColors+=assertSameGeometryAndFinish(after.run(expression),before.run(expression),'árvore '+variant+'/LOD '+detail);
 }
 for(const kind of ['meadow','litter','shrub','fern','broadleaf','grass','tuft','groundcover','flower'])
  for(const detail of [0,1])for(let variant=0;variant<6;variant++){
   const expression=`makePlantModel(${JSON.stringify(kind)},${variant},${detail}).vertices`;
   changedColors+=assertSameGeometryAndFinish(after.run(expression),before.run(expression),kind+' '+variant+'/LOD '+detail);
  }
 assert.ok(changedColors>0,'a paleta deve produzir uma mudança visível nos albedos');
});

test('um corpo e vários corpos conservam resultados da física original',()=>{
 const [before,after]=runPair();
 for(const count of [1,8]){
  const setup=`state.d=5;state.r=4;syncCavityMotion();state.cargo=Array(${count}).fill(0);state.cargoPoses=[];restoreCargoPhysics()`;
  for(const g of [before,after])g.run(setup);
  for(let part=0;part<4;part++){
   const step=`for(let i=0;i<60;i++)stepCargoPhysics(1/60,${part===1?'.02':'0'},0);saveCargoPhysics()`;
   for(const g of [before,after])g.run(step);
   assert.deepEqual(after.json('state.cargoPoses'),before.json('state.cargoPoses'));
   assert.deepEqual(after.json('cargoBodies.map(b=>({q:b.q,v:b.v,w:b.w,sleeping:b.sleeping,quiet:b.quiet}))'),before.json('cargoBodies.map(b=>({q:b.q,v:b.v,w:b.w,sleeping:b.sleeping,quiet:b.quiet}))'));
  }
 }
});
