import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

const html=assemble().html;

test('comprar raio amplia a abertura projetada sem afastar a câmera ou depender de movimento',()=>{
 const g=createRuntime(html);
 g.run(`
  globalThis.openingWidth=()=>{
   const vp=prepareSceneCamera().vp;
   const project=(x,z)=>{
    const X=player.x+x,Z=player.y+z,Y=cavityVisual.elevation;
    return (vp[0]*X+vp[4]*Y+vp[8]*Z+vp[12])/
     (vp[3]*X+vp[7]*Y+vp[11]*Z+vp[15]);
   };
   const a=viewYaw+Math.PI/2,r=apertureRadius(a),s=apertureRadius(a+Math.PI);
   return Math.abs(project(Math.sin(a)*r,Math.cos(a)*r)-project(-Math.sin(a)*s,-Math.cos(a)*s));
  };
  state.developer=true;
 `);
 for(const level of [0,9,14,19]){
  g.run(`state.r=${level};cameraZoomFactor=.8;syncCavityMotion();rebuildCavity();
   globalThis.beforeGrowth={width:openingWidth(),distance:smoothZoom,r:physicalRadius(),x:player.x,y:player.y};`);
  g.doc.getElementById('radiusBtn').click();
  g.run('for(let i=0;i<120;i++)update(1/60);rebuildCavity()');
  assert.equal(g.run('state.r'),level+1);
  assert.equal(g.run('physicalRadius()'),g.run('meters(HOLE_RADII[state.r])'));
  assert.ok(Math.abs(g.run('smoothZoom-beforeGrowth.distance'))<1e-8,'preserva a distância no nível '+level);
  assert.ok(g.run('openingWidth()>beforeGrowth.width*1.05'),'crescimento visível no nível '+level);
  assert.equal(g.run('player.x===beforeGrowth.x&&player.y===beforeGrowth.y'),true);
 }
});

test('compra recusada preserva câmera e raio; crescimento sem animações e restauração conservam o nível',()=>{
 const g=createRuntime(html);
 g.run(`state.r=14;state.coins=0;cameraZoomFactor=.7;syncCavityMotion();
  globalThis.oldCameraFactor=cameraZoomFactor;upgrade('r');`);
 assert.equal(g.run('state.r'),14);
 assert.equal(g.run('cameraZoomFactor'),g.run('oldCameraFactor'));
 g.run(`state.coins=1e6;state.motion=false;upgrade('r');tickSceneMotion(2);persist()`);
 assert.equal(g.run('state.r'),15);
 assert.equal(g.run('physicalRadius()'),g.run('meters(HOLE_RADII[15])'));
 const restored=createRuntime(html,JSON.parse(g.store.get('vora-v1')));
 assert.equal(restored.run('state.r'),15);
 assert.equal(restored.run('physicalRadius()'),g.run('physicalRadius()'));
});
