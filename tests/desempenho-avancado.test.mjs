import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble,read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('índice de coleta conserva candidatos e ordem em bordas, tamanhos e alterações do mundo',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`objects=Array.from({length:3000},(_,i)=>({x:(i%60-30)*31,y:(Math.floor(i/60)-25)*37,t:i%4,alive:i%7!==0}));
  globalThis.pickupQueries=[[-128,-128,.96],[0,0,8],[127,128,75],[-600,430,150],[0,0,1600]];
  globalThis.indexComparison=pickupQueries.map(([x,y,r])=>{
   const expected=objects.filter(o=>Math.abs(o.x-x)<=r&&Math.abs(o.y-y)<=r);
   const actual=nearbyPickupObjects(x,y,r).map(record=>record.object).filter(o=>Math.abs(o.x-x)<=r&&Math.abs(o.y-y)<=r);
   return expected.length===actual.length&&expected.every((o,i)=>o===actual[i]);
  });`);
 assert.ok(g.json('indexComparison').every(Boolean));
 assert.ok(g.run('nearbyPickupObjects(0,0,10).length')<g.run('objects.length')/20);
 g.run('objects.push({x:0,y:0,t:0,alive:true})');
 assert.equal(g.run('nearbyPickupObjects(0,0,1).at(-1).object===objects.at(-1)'),true);
 g.run('objects[0].x=0;objects[0].y=0;invalidateSpawnObstacles()');
 assert.equal(g.run('nearbyPickupObjects(0,0,1)[0].object===objects[0]'),true);
 g.run('objects=[{x:0,y:0,t:1,alive:true}]');assert.equal(g.run('nearbyPickupObjects(0,0,1).length'),1);
});

test('buraco low poly reduz triângulos e conserva amostras do perfil e o fundo físico',()=>{
 const g=createRuntime(html);
 const fixtures=[[0,0,0,100,70],[2,3,17.8,-125,30],[8,10,456,380,-150],[20,20,2099,-340,-360]];
 for(const [r,d,travel,x,z]of fixtures){
  g.run(`{state.r=${r};state.d=${d};player.x=${x};player.y=${z};travelDistance=${travel};syncCavityMotion();
   globalThis.floorBefore=[cavityHeightAt(0,0),cavityHeightAt(physicalRadius()*.4,0)];
   geometryKey='';rebuildCavity();
   globalThis.sampleError=0;
   const b=cavityBuffers;
   for(let j=0;j<b.rows.length;j++)for(let i=0;i<b.N;i++){
    const row=b.rows[j],expected=surfaceVertex(b.angles[i],row.section,row.u),offset=(j*b.N+i)*3;
    for(let k=0;k<3;k++)sampleError=Math.max(sampleError,Math.abs(expected[k]-b.points[offset+k]));
   }}`);
  assert.ok(g.run('sampleError')<1e-9,'o perfil continua fiel no raio '+r);
  assert.deepEqual(g.json('[cavityHeightAt(0,0),cavityHeightAt(physicalRadius()*.4,0)]'),g.json('floorBefore'));
  assert.ok(g.run('Object.values(cavityBuffers.parts).reduce((sum,p)=>sum+p.indices.length/3,0)')<=1500);
  assert.equal(g.run('cavityBuffers.normals.every(Number.isFinite)'),true);
  assert.equal(g.run('Object.values(cavityBuffers.parts).every(p=>p.indices.every(i=>i<cavityBuffers.points.length/3))'),true);
  assert.equal(g.run(`['wall','floor'].every(name=>{
   const data=cavityBuffers.parts[name].data;
   for(let i=0;i<data.length;i+=27)for(let j=3;j<6;j++)
    if(data[i+j]!==data[i+j+9]||data[i+j]!==data[i+j+18])return false;
   return true;
  })`),true,'o fallback também ilumina cada triângulo como uma face plana');
 }
});

function instances(mode='native'){
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`
  gl.isSoftware=false;Object.assign(attrib,{p:0,n:1,c:2});
  for(const name of ['origin','scale','rotation','tint','material','reactive','instanced'])uniforms[name]=name;
  gl.getAttribLocation=(p,name)=>({a_instanceOrigin:3,a_instanceScale:4,a_instanceRotation:5}[name]??0);
  globalThis.instanceCalls=[];globalThis.attributeDivisors={};globalThis.instancePointers={};globalThis.instanceBindings=new Map();
  gl.bindBuffer=(target,buffer)=>instanceBindings.set(target,buffer);
  gl.bufferData=(target,data)=>{const b=instanceBindings.get(target);b.data=typeof data==='number'?new Float32Array(data/4):new Float32Array(data);};
  gl.bufferSubData=(target,offset,data)=>instanceBindings.get(target).data.set(data,offset/4);
  gl.vertexAttribPointer=(location,size,type,normalized,stride,offset)=>{instancePointers[location]={buffer:instanceBindings.get(gl.ARRAY_BUFFER),size,stride,offset};};
  gl.disableVertexAttribArray=()=>{};
  globalThis.captureInstances=(count,n,indexed)=>instanceCalls.push({count,n,indexed,
   records:Array.from(instancePointers[3].buffer.data.slice(0,n*7)),reactive:gl.u.reactive,instanced:gl.u.instanced});
  gl.drawArrays=()=>instanceCalls.push({n:1,ordinary:true});
  gl.drawElements=()=>instanceCalls.push({n:1,ordinary:true});
  gl.DYNAMIC_DRAW=35048;gl.ELEMENT_ARRAY_BUFFER=34963;
  gl.vertexAttribDivisor=(i,n)=>attributeDivisors[i]=n;
  gl.drawArraysInstanced=(mode,first,count,n)=>captureInstances(count,n,false);
  gl.drawElementsInstanced=(mode,count,type,offset,n)=>captureInstances(count,n,true);
  if('${mode}'==='angle'){
   const angleAPI={vertexAttribDivisorANGLE:gl.vertexAttribDivisor,drawArraysInstancedANGLE:gl.drawArraysInstanced,drawElementsInstancedANGLE:gl.drawElementsInstanced};
   gl.getExtension=()=>angleAPI;
   gl.vertexAttribDivisor=gl.drawArraysInstanced=gl.drawElementsInstanced=undefined;
  }
  initObjectInstancing();
  globalThis.instanceMesh=mesh(new Float32Array([0,0,0,0,1,0,.4,.5,.6,1,0,0,0,1,0,.4,.5,.6,0,1,0,0,1,0,.4,.5,.6]));
 `);return g;
}

for(const mode of ['native','angle'])test(`instancing ${mode} mantém todos os transforms, expande buffers e restaura desenho comum`,()=>{
 const g=instances(mode);
 g.run(`beginObjectInstances();for(let i=0;i<150;i++)drawMesh(instanceMesh,i*3,i*.25,-i,1+i*.01,.7,2,[1,1,1],14,i*.037);endObjectInstances();`);
 assert.equal(g.run('instanceCalls.length'),1);assert.equal(g.run('instanceCalls[0].n'),150);
 const records=g.json('instanceCalls[0].records');
 for(let i=0;i<150;i++)assert.deepEqual(records.slice(i*7,i*7+7),Array.from(new Float32Array([i*3,i*.25,-i||0,1+i*.01,.7,2,i*.037])));
 assert.equal(g.run('gl.u.instanced'),0);
 assert.deepEqual(g.json('attributeDivisors'),{'3':0,'4':0,'5':0});
 g.run('drawMesh(instanceMesh,0,0,0,1,1,1,[1,1,1],14)');assert.equal(g.run('instanceCalls.at(-1).ordinary'),true);
 g.run('instanceMesh.indexBuffer={};beginObjectInstances();drawMesh(instanceMesh,0,0,0,1,1,1,[1,1,1],14);endObjectInstances()');
 assert.equal(g.run('instanceCalls.at(-1).indexed'),true);
});

test('sombras conservam emissores fora da câmera; TAA e corpos físicos mantêm caminhos próprios',()=>{
 const g=instances();
 g.run(`vegetationPlanes=Array.from({length:6},()=>[1,0,0,-1000]);
  beginObjectInstances();drawMesh(instanceMesh,0,0,0,1,1,1,[1,1,1],14);endObjectInstances();`);
 assert.equal(g.run('instanceCalls.length'),0,'a cena elimina o objeto fora da câmera');
 g.run(`renderingShadow=true;lighting={image:{taaActive:true}};
  beginObjectInstances();drawMesh(instanceMesh,0,0,0,1,1,1,[1,1,1],14);
  reactiveDraw=true;drawMesh(instanceMesh,2,0,0,1,1,1,[1,1,1],14);reactiveDraw=false;endObjectInstances();`);
 assert.equal(g.run('instanceCalls.length'),2,'reatividade temporal não se mistura no lote');
 assert.deepEqual(g.json('instanceCalls.map(c=>c.reactive)'),[0,1]);
 g.run('currentBodyRotation=new Float32Array(BODY_IDENTITY);beginObjectInstances();drawMesh(instanceMesh,0,0,0,1,1,1,[1,1,1],14);endObjectInstances()');
 assert.equal(g.run('instanceCalls.at(-1).ordinary'),true);
});

test('sem suporte a instancing e no fallback CPU o desenho individual continua disponível',()=>{
 const g=createRuntime(html,null,{boot:'manual'});g.run('initObjectInstancing()');
 assert.equal(g.run('objectInstanceAPI'),null);assert.equal(g.run('beginObjectInstances()'),false);
 g.run('gl.isSoftware=false;gl.getExtension=()=>null;initObjectInstancing()');
 assert.equal(g.run('objectInstanceAPI'),null);
});
