import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

test('recursos mantêm o modelo e a escala durante a queda e depois de pousar; pose restaura sem perder o objeto',()=>{
 const g=createRuntime(html);
 g.run(`state.r=20;state.d=10;syncCavityMotion();
  globalThis.targets=['boulder','bench','tree'].map(kind=>worldResourceObjects.find(o=>
   o.alive&&(o.worldProp.kind===kind||o.worldProp.type===kind)&&pickupSize(o)>10&&pickupSize(o)<80&&canSwallow(o)&&pickupVolume(o)<40));
  globalThis.falls=[];
  for(const o of targets){
   player.x=o.x+(1-targets.indexOf(o))*180;player.y=o.y;collect(o);
   const b=cargoBodies.at(-1),height=b.z;stepCargoPhysics(1/60);
   falls.push({same:b.resource===o.worldProp,larger:b.shape.extent>CARGO_SHAPES[b.t].extent,
    down:b.z<height,visible:!!b.shape.visual.mesh.count,initial:b.z});
  }
  for(let i=0;i<600;i++)stepCargoPhysics(1/120);
  persist();`);
 assert.equal(g.run('targets.every(Boolean)'),true);
 assert.ok(g.json('falls').every(f=>f.same&&f.larger&&f.down&&f.visible),JSON.stringify(g.json('falls')));
 assert.equal(g.run('worldResourceFalls.length'),0,'não há cópia que encolhe e some');
 assert.equal(g.run('cargoBodies.length'),3);
 assert.equal(g.run('cargoBodies.every(b=>Number.isFinite(b.z)&&b.z+b.half+b.shape.extent>=-cavityDepth())'),true,JSON.stringify(g.json('cargoBodies.map(b=>({z:b.z,half:b.half,extent:b.shape.extent}))')));
 assert.equal(g.run('cargoBodies.every((b,i)=>b.z<falls[i].initial-1)'),true,'gravidade continua depois da coleta');
 g.run(`globalThis.cargoDraws=[];drawMesh=(m,x,y,z,sx,sy,sz)=>cargoDraws.push({m,s:[sx,sy,sz]});drawStored();`);
 assert.equal(g.run('cargoDraws.every((d,i)=>d.m===cargoBodies[i].shape.visual.mesh&&d.s.every((s,j)=>s===cargoBodies[i].shape.visual.scale[j]))'),true);
 const saved=JSON.parse(g.store.get('vora-v1'));
 assert.equal(saved.cargoPoses.filter(p=>p.resourceId).length,3);
 const restored=createRuntime(html,saved);
 assert.deepEqual(restored.json('cargoBodies.map(b=>b.resource.resourceId)'),g.json('cargoBodies.map(b=>b.resource.resourceId)'));
 const before=g.json('cargoBodies.map(b=>[b.lx,b.z,b.ly,...b.q])');
 const after=restored.json('cargoBodies.map(b=>[b.lx,b.z,b.ly,...b.q])');
 assert.ok(after.every((pose,i)=>pose.every((v,j)=>Math.abs(v-before[i][j])<1e-10)));
 restored.run('setInsidePinned(true);drawInside(1000,true)');
 assert.equal(restored.run('insideView.stats.cargoObjects'),3);
});

test('objetos com colisores maiores que a célula antiga ainda colidem entre si',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`cargoBodies=[createCargoBody(0,0,-35,0),createCargoBody(0,1,35,0)];
  for(const b of cargoBodies){b.spheres=b.spheres.slice(0,1);Object.assign(b.spheres[0],{ox:0,oy:0,oz:0,r:40});}
  solveCargoPairs();`);
 assert.equal(g.run('cargoBodies.every(b=>b.contacts>0)'),true);
 assert.ok(g.run('cargoBodies[1].lx-cargoBodies[0].lx')>70,'contato separa os corpos sobrepostos');
});

test('carga adormecida volta à física quando o deslocamento altera a forma do fundo',()=>{
 const g=createRuntime(html);
 g.run(`state.r=5;state.d=5;syncCavityMotion();state.cargo=[0];restoreCargoPhysics();
  const b=cargoBodies[0];b.sleeping=true;b.quiet=1;
  travelDistance+=1;stepCargoPhysics(1/60);`);
 assert.equal(g.run('cargoBodies[0].sleeping'),false);
 assert.equal(g.run('fallingItems.includes(cargoBodies[0])'),true);
});
