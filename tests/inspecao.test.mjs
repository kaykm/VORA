import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
import {png} from './png.mjs';
const html=assemble().html;

function setup(){
 const g=createRuntime(html,null,{width:1000,height:800});
 g.run(`W=1000;H=800;
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:1000,height:800});
  globalThis.target={t:0,x:160,y:100,rot:.33,alive:true,anim:null,zoneId:'teste'};objects=[target];
  globalThis.objectPointer=()=>{const p=projectInspectionMesh(target,dossierModel(target),prepareSceneCamera().vp,canvas.getBoundingClientRect());return {clientX:p.cx,clientY:p.cy};};
  globalThis.stepInspection=seconds=>{for(let t=0;t<seconds;t+=1/60){tickSceneMotion(1/60);tickObjectInspection(1/60);}};
  globalThis.objectBefore=JSON.stringify(target);`);
 return g;
}
function press(g,id=1,type='mouse'){
 const pointer=g.json('objectPointer()');
 g.doc.getElementById('world').dispatchEvent({type:'pointerdown',pointerType:type,pointerId:id,button:0,...pointer});
 return pointer;
}

test('segurar mostra análise imediatamente, progride e cancela ao soltar, arrastar ou usar dois dedos',()=>{
 const g=setup(),world=g.doc.getElementById('world'),p=press(g);
 assert.equal(g.doc.getElementById('objectHighlight').hidden,false);
 assert.equal(g.doc.getElementById('objectHoldHint').hidden,false);
 assert.equal(g.doc.getElementById('objectHoldProgress').textContent,'0%');
 assert.equal(g.run('openMenu'),null);
 g.advanceClock(1000);g.run('tickObjectInspection(1);updateObjectHighlight(prepareSceneCamera().vp)');
 assert.equal(g.run('objectInspection.hold.progress'),.5);
 assert.equal(g.doc.getElementById('objectHoldProgress').textContent,'50%');
 assert.equal(g.run('openMenu'),null,'a indicação não abre a inspeção antes de dois segundos');
 const yaw=g.run('viewYaw');
 world.dispatchEvent({type:'pointermove',pointerId:1,clientX:p.clientX+3,clientY:p.clientY});
 assert.equal(g.run('viewYaw'),yaw,'pequeno tremor durante a pressão não move a câmera');
 const timer=g.run('objectInspection.hold.timer');
 world.dispatchEvent({type:'pointermove',pointerId:1,clientX:p.clientX+15,clientY:p.clientY});
 assert.equal(g.run('objectInspection.hold'),null);assert.equal(g.timers.has(timer),false);
 assert.equal(g.doc.getElementById('objectHighlight').hidden,true);
 assert.equal(g.doc.getElementById('objectHoldHint').hidden,true);
 world.dispatchEvent({type:'pointerup',pointerId:1});
 press(g,2);world.dispatchEvent({type:'pointerup',pointerId:2});
 assert.equal(g.run('objectInspection.hold'),null);
 press(g,3,'touch');press(g,4,'touch');
 assert.equal(g.run('objectInspection.hold'),null,'pinça cancela a análise');
 world.dispatchEvent({type:'pointercancel',pointerId:3});world.dispatchEvent({type:'pointercancel',pointerId:4});
 press(g,5);g.event('blur');assert.equal(g.run('objectInspection.hold'),null);
 assert.equal(g.run('JSON.stringify(target)===objectBefore'),true);
});

test('entrada e retorno são graduais; parallax é amortecido e todos os dados pertencem ao item real',()=>{
 const g=setup();g.run('motionMedia.matches=false;state.motion=true;globalThis.before=inspectionCameraView();globalThis.inspectionSaveBefore=JSON.stringify(state)');
 press(g);g.runTimer();
 assert.equal(g.run('openMenu.id'),'objectCheckModal');
 assert.equal(g.run('objectInspection.object===target'),true);
 assert.equal(g.run('cameraPan.x'),g.run('before.pan.x'),'a abertura não salta a câmera');
 const destination=g.run('objectInspection.focus.pan.x');
 g.run('stepInspection(.4)');
 const start=g.run('before.pan.x'),during=g.run('cameraPan.x');
 assert.ok(during>Math.min(start,destination)&&during<Math.max(start,destination));
 g.run('stepInspection(.65)');
 assert.equal(g.run('objectInspection.transition'),null);
 assert.equal(g.run('cameraPan.x'),destination);
 assert.equal(g.doc.getElementById('objectCheckValue').textContent,'4 moedas');
 assert.equal(g.doc.getElementById('objectCheckVolume').textContent,g.run("met(pickupVolume(target))+' L'"));
 assert.equal(g.run('JSON.stringify(state)===inspectionSaveBefore'),true,'inspeção não altera o save');
 const yaw=g.run('viewYaw');
 g.event('pointermove',{pointerType:'mouse',clientX:1000,clientY:0});
 assert.equal(g.run('viewYaw'),yaw,'parallax não acompanha o ponteiro em um salto');
 g.run('stepInspection(.1)');
 assert.ok(g.run('viewYaw')>yaw&&g.run('viewYaw')<yaw+.035);
 g.run('stepInspection(3)');
 assert.ok(Math.abs(g.run('viewYaw')-yaw-.035)<.0001);
 assert.ok(Math.abs(g.run('viewElevation-objectInspection.focus.elevation'))<=.02201);
 g.run('updateObjectHighlight(prepareSceneCamera().vp)');
 assert.equal(g.doc.getElementById('objectHighlight').hidden,false);
 assert.equal(g.doc.getElementById('objectCheckModal').dataset.compact,'false');
 g.run('closeMenu(true)');
 assert.equal(g.run('objectInspection.object'),null);
 assert.notEqual(g.run('cameraPan.x'),g.run('before.pan.x'),'retorno também começa sem salto');
 assert.equal(g.doc.getElementById('objectHighlight').hidden,true);
 assert.equal(g.doc.activeElement.id,'detailsBtn');
 g.run('stepInspection(.8)');
 assert.deepEqual(g.json('cameraPan'),g.json('before.pan'));
 assert.equal(g.run('viewYaw'),g.run('before.yaw'));
 assert.equal(g.run('cameraZoomFactor'),g.run('before.factor'));
 assert.equal(g.run('JSON.stringify(target)===objectBefore'),true);
});

test('silhueta rasteriza a união da malha: preserva concavidade e não desenha diagonais internas',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`globalThis.shape={left:0,top:0,width:104,height:104,points:new Float32Array([
  4,4,34,4,4,94, 34,4,34,94,4,94,
  34,64,94,64,34,94, 94,64,94,94,34,94])};
  globalThis.outline=rasterizeInspectionMesh(shape);
  globalThis.maskAt=(x,y)=>outline.mask[y*INSPECTION_MASK_SIDE+x];
  globalThis.alphaAt=(x,y)=>outline.pixels[(y*INSPECTION_MASK_SIDE+x)*4+3];`);
 assert.equal(g.run('maskAt(20,20)'),1);
 assert.equal(g.run('alphaAt(20,20)'),0,'a superfície não recebe preenchimento nem contornos internos');
 assert.equal(g.run('maskAt(75,20)'),0,'o vazio dentro da caixa delimitadora permanece vazio');
 assert.equal(g.run('alphaAt(75,20)'),0,'não existe retângulo em volta dos limites');
 assert.ok(g.run('alphaAt(35,20)')>0,'a borda acompanha a lateral real');
 assert.equal(g.run('maskAt(75,80)'),1,'o braço da concavidade está presente');
 g.run('globalThis.previousMask=outline.mask;globalThis.previousPixels=outline.pixels;rasterizeInspectionMesh(shape,outline)');
 assert.equal(g.run('outline.mask===previousMask&&outline.pixels===previousPixels'),true,'buffers são reutilizados');
 assert.equal(g.run('outline.mask.length'),512*512);
});

test('malhas de lata, banco e árvore geram contornos distintos e ancoram as linhas na superfície',()=>{
 const g=setup();
 for(const [name,source]of [
  ['lata','target'],['banco',"worldResourceObjects.find(o=>o.alive&&o.worldProp.type==='bench')"],
  ['arvore',"worldResourceObjects.find(o=>o.alive&&o.worldProp.type==='tree')"]
 ]){
  g.run(`inspectObject(${source});updateObjectHighlight(prepareSceneCamera().vp);`);
  const r=g.json('({width:objectInspection.raster.width,height:objectInspection.raster.height,scale:objectInspection.raster.scale})');
  assert.ok(r.width<=512&&r.height<=512&&r.width>8&&r.height>8);
  assert.ok(g.run('objectInspection.raster.mask.some(x=>x===1)'));
  for(const side of ['left','right']){
   const onSurface=g.run(`(()=>{const r=objectInspection.raster,a=inspectionSurfaceAnchor('${side}',.5),x=Math.round((a.x-r.left)*r.scale),y=Math.round((a.y-r.top)*r.scale);return r.mask[y*512+x]===1;})()`);
   assert.equal(onSurface,true);
  }
  // Diagnostic image of the production mesh mask, not a browser layout capture.
  const pixels=g.run(`(()=>{const r=objectInspection.raster,data=new Uint8ClampedArray(512*512*4);
   for(let i=0;i<512*512;i++){const p=i*4,on=r.mask[i],edge=r.pixels[p+3]>0;
    data[p]=edge?211:on?74:20;data[p+1]=edge?244:on?102:32;data[p+2]=edge?184:on?69:26;data[p+3]=255;}
   return data;})()`);
  fs.mkdirSync('tests/resultados',{recursive:true});fs.writeFileSync(`tests/resultados/inspecao-silhueta-${name}.png`,png(512,512,pixels));
  g.run('closeMenu(false,true)');
 }
});

test('movimento reduzido mantém progresso e dados, sem parallax, partículas orbitais ou transição de câmera',()=>{
 const g=setup();press(g);g.runTimer();
 assert.equal(g.run('motionAllowed()'),false);
 assert.equal(g.run('objectInspection.transition'),null);
 assert.equal(g.run('cameraPan.x'),g.run('objectInspection.focus.pan.x'));
 const yaw=g.run('viewYaw');g.event('pointermove',{clientX:1000,clientY:0,pointerType:'mouse'});
 g.run('stepInspection(.5)');assert.equal(g.run('viewYaw'),yaw);
 g.run('closeMenu(false,true)');assert.deepEqual(g.json('cameraPan'),{x:0,y:0,z:0});
 // Portrait framing leaves room for the annotation list, and restores the lens.
 g.run('innerWidth=390;innerHeight=844;visualViewport.width=390;visualViewport.height=844;W=390;H=844;inspectObject(target);updateObjectHighlight(prepareSceneCamera().vp)');
 assert.equal(g.doc.getElementById('objectCheckModal').dataset.compact,'true');
 assert.ok(g.run('objectInspection.screenLift')>0);
 g.run('closeMenu(false,true)');assert.equal(g.run('objectInspection.screenLift'),0);
});

test('deslocamento da lente mantém terreno CPU e reconstrução espacial do AO alinhados',()=>{
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`globalThis.groundCheck=new SoftwareGL(document.createElement('canvas'));
  groundCheck.viewport(0,0,160,120);groundCheck.camera={eye:[0,100,100],target:[0,0,0],aspect:4/3,fov:.74,screenLift:0};
  globalThis.groundView=lookAt(groundCheck.camera.eye,groundCheck.camera.target);
  globalThis.groundProjection=perspective(.74,4/3,2,4000);
  groundCheck.u.viewProjection=multiply(groundProjection,groundView);groundCheck.u.hole=[9999,9999,0];
  groundCheck.clear();groundCheck.drawGround();globalThis.groundBefore=groundCheck.image.data.slice();globalThis.depthBefore=groundCheck.zbuffer.slice();
  groundCheck.camera.screenLift=.3;groundProjection[9]=-.3;
  groundCheck.u.viewProjection=multiply(groundProjection,groundView);groundCheck.clear();groundCheck.drawGround();`);
 for(const [x,y]of [[20,30],[80,42],[130,65]]){
  const before=g.json(`Array.from(groundBefore.slice(((${y}+18)*160+${x})*4,((${y}+18)*160+${x})*4+4))`);
  const after=g.json(`Array.from(groundCheck.image.data.slice((${y}*160+${x})*4,(${y}*160+${x})*4+4))`);
  assert.deepEqual(after,before,'a lente move o mesmo ponto do chão 18 pixels para cima');
  assert.equal(g.run(`groundCheck.zbuffer[${y}*160+${x}]`),g.run(`depthBefore[(${y}+18)*160+${x}]`));
 }
 g.run(`objectInspection.screenLift=.3;lighting={ao:{viewRotation:new Float32Array(9)},image:{taaActive:false}};
  globalThis.inspectionUniforms={};gl.uniform2f=(u,x,y)=>inspectionUniforms[u]=[x,y];
  gl.uniformMatrix3fv=gl.activeTexture=gl.bindTexture=gl.uniform1i=()=>{};
  ambientUniforms({projection:'p',projectionJitter:'j'},{renderWidth:160,renderHeight:120,width:160,height:120},4/3);
  globalThis.reconstructionError=(()=>{
   const point=[12,0,16,1],vp=groundCheck.u.viewProjection,mul=m=>Array.from({length:4},(_,i)=>point.reduce((sum,v,j)=>sum+m[j*4+i]*v,0));
   const clip=mul(vp),actual=mul(groundView),uv=[clip[0]/clip[3]*.5+.5,clip[1]/clip[3]*.5+.5],z=-actual[2];
   const reconstructed=uv.map((u,i)=>((u-inspectionUniforms.j[i])*2-1)*inspectionUniforms.p[i]*z);
   return Math.hypot(reconstructed[0]-actual[0],reconstructed[1]-actual[1]);
  })();`);
 assert.ok(g.run('reconstructionError')<.0001,'o AO reconstrói a superfície na posição real após a mudança de lente');
});
