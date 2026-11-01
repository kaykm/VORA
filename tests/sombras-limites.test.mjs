import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
const html=assemble().html;

function boundsRuntime(){
 const g=createRuntime(html,null,{boot:'manual'});
 g.run(`
  gl.isSoftware=false;state.shadowQuality='high';state.depot=[];
  shaderProgram='scene-program';
  Object.assign(gl,{TEXTURE0:33984,TEXTURE_2D:3553,TEXTURE_MIN_FILTER:10241,TEXTURE_MAG_FILTER:10240,
   NEAREST:9728,FRAMEBUFFER:36160,DITHER:3024,BLEND:3042,DEPTH_TEST:2929,TRIANGLES:4,MAX_TEXTURE_IMAGE_UNITS:34930});
  globalThis.boundsAllocated=[],boundsReleased=[],boundsState=[],boundsPasses=0;
  gl.uniform1i=(location,value)=>boundsState.push(['sampler',location,value]);gl.uniform2f=()=>{};gl.uniform4f=()=>{};
  gl.bindTexture=(...args)=>boundsState.push(['texture',...args]);gl.activeTexture=unit=>boundsState.push(['unit',unit]);
  gl.texParameteri=(...args)=>boundsState.push(['filter',...args]);
  gl.deleteTexture=value=>boundsReleased.push(value);gl.deleteFramebuffer=value=>boundsReleased.push(value);
  gl.deleteRenderbuffer=value=>boundsReleased.push(value);
  gl.depthMask=value=>boundsState.push(['depthWrite',value]);
  gl.enable=value=>boundsState.push(['enable',value]);gl.disable=value=>boundsState.push(['disable',value]);
  gl.useProgram=value=>boundsState.push(['program',value]);gl.bindFramebuffer=()=>{};gl.viewport=()=>{};
  gl.drawArrays=()=>boundsPasses++;
  makeColorTarget=(width,height)=>{const n=boundsAllocated.length;
   const target={width,height,texture:'bound-texture-'+n,fbo:'bound-fbo-'+n,valid:true};
   boundsAllocated.push(target);return target;
  };
  lighting={valid:true,shadowBounds:{program:'bound-program'},fixed:{size:2048,texture:'fixed'},moving:{size:1024,texture:'moving'},size:1024,staticVersion:0};
 `);
 return g;
}

test('cache de sombras tem orçamento limitado, usa amostragem exata e só aloca na preparação',()=>{
 const g=boundsRuntime();
 g.run('globalThis.preparation=prepareShadowBoundsTarget(lighting.fixed);preparation.next()');
 assert.equal(g.run('boundsAllocated.length'),0,'a primeira etapa devolve controle antes da alocação');
 g.run('preparation.next()');
 assert.equal(g.run('lighting.fixed.bounds.bytes'),1024*1024);
 assert.equal(g.run('lighting.fixed.bounds.ready'),false,'memória alocada não significa conteúdo pronto');
 assert.equal(g.run('boundsState.filter(x=>x[0]==="filter"&&x[3]===gl.NEAREST).length'),2);
 g.run('deleteShadowBounds(lighting.fixed);deleteShadowBounds(lighting.fixed)');
 assert.equal(g.run('boundsReleased.length'),2,'cada alocação é liberada uma vez');
 for(const setting of ["state.shadowQuality='balanced'", "state.shadowQuality='off'", "state.shadowQuality='high';lighting.fixed.size=1501"]){
  g.run(setting+';preparation=prepareShadowBoundsTarget(lighting.fixed);while(!preparation.next().done){}');
  assert.equal(g.run('boundsAllocated.length'),1,'filtro pequeno ou tamanho não divisível usa o caminho completo');
 }
 g.run(`state.shadowQuality='ultra';lighting.fixed.size=4096;
  preparation=prepareShadowBoundsTarget(lighting.fixed);preparation.next();preparation.return()`);
 assert.equal(g.run('boundsAllocated.length'),1,'cancelamento antes da alocação não deixa recurso pendente');
 g.run('preparation=prepareShadowBoundsTarget(lighting.fixed);while(!preparation.next().done){}');
 assert.equal(g.run('lighting.fixed.bounds.bytes'),4*1024*1024,'Ultra limita o resumo estático a 4 MiB');
});

test('troca cancelada libera resumos e mapas novos sem substituir o par válido',()=>{
 const g=boundsRuntime();
 g.run(`state.shadowQuality='ultra';globalThis.previousFixed=lighting.fixed,previousMoving=lighting.moving;
  globalThis.createdShadows=0;
  makeShadowTarget=size=>{const n=createdShadows++;return {size,valid:true,fbo:'f'+n,depth:'d'+n,texture:'t'+n}};
  globalThis.replacement=replaceShadowTargets({fixed:4096,moving:2048});
  replacement.next();replacement.next();replacement.next();`);
 assert.equal(g.run('boundsAllocated.length'),1);
 assert.equal(g.run('lighting.fixed===previousFixed&&lighting.moving===previousMoving'),true);
 g.run('replacement.return()');
 assert.equal(g.run('boundsReleased.length'),8,'dois mapas e o resumo são liberados');
 assert.equal(g.run('lighting.fixed===previousFixed&&lighting.moving===previousMoving'),true);
});

test('concluir novos mapas solicita apresentação mesmo com mundo e câmera parados',()=>{
 const g=boundsRuntime();
 g.run('sceneMotionActive=false;');
 assert.equal(g.run('shouldRenderSceneFrame()'),true);
 assert.equal(g.run('shouldRenderSceneFrame()'),false,'apresentação estável já foi retida');
 g.run(`makeShadowTarget=size=>({size,valid:true,fbo:'new-fbo',depth:'new-depth',texture:'new-texture'});
  globalThis.replacement=replaceShadowTargets({fixed:2048,moving:1024});
  while(!replacement.next().done){}`);
 assert.equal(g.run('shouldRenderSceneFrame()'),true,'o término da fila exige um quadro com os mapas novos');
 assert.equal(g.run('shouldRenderSceneFrame()'),false,'depois do quadro atualizado, pode voltar ao repouso');
});

test('resumo é reconstruído junto do mapa estático e preservado durante câmera e sombras móveis',()=>{
 const g=boundsRuntime();
 g.run(`globalThis.preparation=prepareShadowBoundsTarget(lighting.fixed);while(!preparation.next().done){}
  globalThis.staticPasses=0,movingPasses=0;
  renderShadowLayer=(target,pass)=>{if(pass===2)staticPasses++;else movingPasses++;};
  fitMovingShadowWindow=()=>{lighting.liveSpawns=[];lighting.liveWindow=[0,0,1,1];return 'fixed-window'};
  bindScreenPass=(q,source,target,width,height)=>boundsState.push(['reduction',source,width,height]);
  lighting.center=[camera.x,camera.y];lighting.extent=shadowMapExtent();lighting.key='';
  updateSunShadows();viewYaw+=.7;updateSunShadows();player.x+=1;updateSunShadows();`);
 assert.equal(g.run('staticPasses'),1);
 assert.equal(g.run('movingPasses'),2);
 assert.equal(g.run('boundsPasses'),1,'girar a câmera e mover o buraco não repetem a redução');
 assert.equal(g.run('shadowBoundsReady()'),true);
 g.run('objects.push({alive:true,t:0});updateSunShadows()');
 assert.equal(g.run('staticPasses'),2);assert.equal(g.run('boundsPasses'),2,'mudar emissor invalida o mapa e seu resumo');
 assert.equal(g.run('boundsState.filter(x=>x[0]==="depthWrite").at(-1)[1]'),true);
 assert.equal(g.run('boundsState.filter(x=>x[0]==="program").at(-1)[1]===shaderProgram'),true);
 assert.equal(g.run('boundsState.some((x,i)=>x[0]==="unit"&&x[1]===33991&&boundsState[i+1]?.[0]==="texture"&&boundsState[i+1][2]===null)'),true,'destino é desligado da unidade 7 antes da redução');
 g.run('state.shadowQuality="balanced"');assert.equal(g.run('shadowBoundsReady()'),false);
});

test('falta de suporte, compilação ou alvo opcional mantém as sombras completas',()=>{
 const g=boundsRuntime();
 g.run(`lighting.shadowBounds=null;gl.getParameter=()=>4;
  globalThis.preparation=initShadowBoundsIncremental('vertex');while(!preparation.next().done){}`);
 assert.equal(g.run('lighting.shadowBounds'),null);assert.equal(g.run('boundsAllocated.length'),0);
 g.run(`gl.getParameter=()=>8;globalThis.warnings=[];console={...console,warn:(...args)=>warnings.push(args)};
  screenProgramIncremental=function*(){throw Error('compilação simulada')};
  preparation=initShadowBoundsIncremental('vertex');while(!preparation.next().done){}`);
 assert.equal(g.run('warnings.length'),1);assert.equal(g.run('lighting.shadowBounds'),null);
 g.run('bindShadowBounds()');
 assert.equal(g.run('boundsState.filter(x=>x[0]==="sampler").at(-1)[2]'),4,'fallback reutiliza a textura completa já existente, sem exigir outra unidade');
 g.run(`lighting.shadowBounds={};makeColorTarget=(width,height)=>({width,height,valid:false,fbo:'failed-fbo',texture:'failed-texture'});
  preparation=prepareShadowBoundsTarget(lighting.fixed);while(!preparation.next().done){}`);
 assert.equal(g.run('!!lighting.fixed.bounds'),false);
 assert.deepEqual(g.json('boundsReleased'),['failed-fbo','failed-texture']);
 assert.equal(g.run('lighting.valid'),true,'falha do resumo não invalida os mapas originais');
});
