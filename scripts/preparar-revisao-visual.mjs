// Capture real scene/shadow submissions for native GLES visual regression.
// Preparatory baking happens here, before rendering, in an isolated test world.
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {read,assemble} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';
const baseline=process.argv[2];
if(!baseline)throw Error('Uso: node scripts/preparar-revisao-visual.mjs <HTML anterior>');
const conversion=read('src/graficos/programa.js').split('function compileShader')[0];
const convert=(source,type)=>vm.runInNewContext(conversion+'\nimageShaderSource(type,source)',{
 WEBGL2:true,gl:{VERTEX_SHADER:35633,FRAGMENT_SHADER:35632},source,type});
function literal(source,marker){
 const start=source.indexOf(marker)+marker.length,quote=source[start];let end=start+1;
 if(start<marker.length||!['"',"'",'`'].includes(quote))throw Error('Shader ausente: '+marker);
 for(;end<source.length;end++){if(source[end]==='\\'){end++;continue}if(source[end]===quote)break}
 return source.slice(start,end+1);
}
const width=1000,height=760;
function capture(html){
 const g=createRuntime(html),buffers=[],known=new Map(),scenes={};let draws=[];
 g.context.__visualDraw=(raw,first,count,uniforms,kind)=>{
  if(first<0||first+count>raw.length/9||count%3)throw Error('Faixa inválida.');
  const bytes=Buffer.from(raw.buffer,raw.byteOffset,raw.byteLength),hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(!known.has(hash)){known.set(hash,buffers.length);buffers.push(bytes.toString('base64'))}
  const copy={};for(const [name,value]of Object.entries(uniforms))copy[name]=typeof value==='number'?value:Array.from(value);
  draws.push({buffer:known.get(hash),first,count,uniforms:copy,kind});
 };
 g.run(`
  W=${width};H=${height};canvas.width=W;canvas.height=H;
  state.aaMode='off';state.aoMode='high';state.shadowQuality='high';state.particles=false;
  for(let variant=0;variant<TREE_VARIANTS;variant++)getModelMesh('tree',variant,1);
  for(let variant=0;variant<3;variant++)getModelMesh('bench',variant,1);
  for(let type=0;type<TYPES.length;type++)for(let variant=0;variant<3;variant++)getModelMesh(type,variant,1);
  for(const tile of groundDetailsBatches){
   if(Math.hypot(tile.center[0]-100,tile.center[2]-70)>1050+tile.radius)continue;
   tile.meshes[0]??=bakePlantTile(tile.plants,0);
   if(Math.hypot(tile.center[0]-100,tile.center[2]-70)<700+tile.radius)tile.meshes[1]??=bakePlantTile(tile.plants,1);
   if(typeof vegetationMeshForView!=='function')tile.shadowMesh=bakePlantTile(tile.plants.filter(p=>!isGroundCover(p.kind)&&p.kind!=='tuft'),0);
  }
  for(const object of objects){object.spawnTime=1;object.anim=0;}
  gl.isSoftware=false;objectInstanceAPI=null;opaqueGPU.color=null;
  gl.ELEMENT_ARRAY_BUFFER=34963;gl.UNSIGNED_SHORT=5123;
  globalThis.visualBindings=new Map();
  gl.bindBuffer=(target,buffer)=>{visualBindings.set(target,buffer);if(target===gl.ARRAY_BUFFER)gl.bound=buffer};
  gl.bufferData=(target,data)=>visualBindings.get(target).data=data;
  gl.bufferSubData=(target,offset,data)=>{const buffer=visualBindings.get(target);new Uint8Array(buffer.data.buffer).set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset)};
  gl.activeTexture=gl.bindTexture=gl.bindFramebuffer=gl.invalidateFramebuffer=()=>{};
  gl.uniform1i=(name,value)=>gl.u[name]=value;
  gl.uniform2f=(name,x,y)=>gl.u[name]=[x,y];gl.uniform4f=(name,x,y,z,w)=>gl.u[name]=[x,y,z,w];
  globalThis.visualKind='';const originalTree=drawTree;
  drawTree=(...args)=>{visualKind='tree';try{return originalTree(...args)}finally{visualKind=''}};
  gl.drawArrays=(mode,first,count)=>__visualDraw(gl.bound.data,first,count,gl.u,visualKind);
  gl.drawElements=(mode,count,type,offset)=>{
   const indices=visualBindings.get(gl.ELEMENT_ARRAY_BUFFER).data,raw=gl.bound.data,expanded=new Float32Array(count*9);
   for(let i=0;i<count;i++)expanded.set(raw.subarray(indices[offset/2+i]*9,indices[offset/2+i]*9+9),i*9);
   __visualDraw(expanded,0,count,gl.u,visualKind);
  };
  gl.present=()=>{};
  lighting={};const originalScreenCompiler=screenProgramIncremental;
  screenProgramIncremental=function*(){return {}};
  globalThis.visualAOInitializer=initAmbientOcclusionIncremental('unused');while(!visualAOInitializer.next().done){}
  globalThis.visualAOSettings=[lighting.ao.radius,lighting.ao.strength,AO_PROFILES.high.slices,AO_PROFILES.high.steps];
  screenProgramIncremental=originalScreenCompiler;
 `);
 const poses=[
  ['proximo','camera.x=100;camera.y=70;smoothZoom=430;viewYaw=.5;viewElevation=1.02'],
  ['afastado','camera.x=100;camera.y=70;smoothZoom=1000;viewYaw=.5;viewElevation=1.02'],
  ['calcada','camera.x=-40;camera.y=200;smoothZoom=310;viewYaw=.8;viewElevation=1.18'],
  ['copas','camera.x=350;camera.y=350;smoothZoom=500;viewYaw=.1;viewElevation=.95'],
  ['meio-fio','camera.x=-40;camera.y=200;smoothZoom=210;viewYaw=1.;viewElevation=1.03'],
  ['relva','camera.x=visualPatch.x;camera.y=visualPatch.z;smoothZoom=180;viewYaw=.5;viewElevation=1.1']
 ];
 for(const [name,pose]of poses){
  if(name==='meio-fio')g.run(`objects=[];worldProps=[];groundDetailsBatches=[];
   drawWorldBase=drawDepot=drawSaleGhosts=drawWorldResourceFalls=drawMovingShadowCasters=()=>{}`);
  if(name==='relva')g.run(`
   globalThis.visualPatch=environmentDetails.filter(p=>p.kind==='tuft').sort((a,b)=>Math.hypot(a.x-100,a.z-70)-Math.hypot(b.x-100,b.z-70))[0];
   const plants=environmentDetails.filter(p=>(p.kind==='tuft'||p.kind==='groundcover')&&Math.hypot(p.x-visualPatch.x,p.z-visualPatch.z)<60);
   gl.isSoftware=true;const low=bakePlantTile(plants,0),high=bakePlantTile(plants,1),empty=bakePlantTile([],0);gl.isSoftware=false;
   groundDetailsBatches=[{center:low.sphere.slice(0,3),radius:low.sphere[3],near:null,meshes:[low,high],shadowMesh:empty,plants}];
   drawWalkways=()=>{};
  `);
  g.run(`lighting={valid:true,fixed:{size:2048,texture:'fixed',fbo:'fixed-fbo'},moving:{size:1024,texture:'moving',fbo:'moving-fbo'},
   size:1024,key:'',dynamicKey:'',extent:0,center:null,staticVersion:0};
   cameraPan.x=cameraPan.y=cameraPan.z=0;boundGeometry=null;meshUniformState.fill(NaN);`+pose);
  draws=[];g.run('render()',60000);
  const view=g.run('prepareSceneCamera(false).cameraView');
  scenes[name]={draws,viewRotation:[view[0],view[1],view[2],view[4],view[5],view[6],view[8],view[9],view[10]],
   triangles:draws.reduce((n,d)=>n+d.count/3,0)};
 }
 g.run(`gl.createTexture=()=>({});gl.texParameteri=gl.generateMipmap=()=>{};gl.getExtension=()=>null;
  gl.texImage2D=(...args)=>globalThis.visualTurf=args.at(-1);makeTurfTexture()`);
 const turf=g.run('visualTurf'),source=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 const screen=g.run(literal(source,'const vs='));
 return {buffers,scenes,aoSettings:g.json('visualAOSettings'),turf:Buffer.from(turf.buffer,turf.byteOffset,turf.byteLength).toString('base64'),
  programs:{scene:[convert(g.run('vertexSource'),35633),convert(g.run('fragmentSource'),35632)],
   horizon:[convert(screen,35633),convert(g.run('AO_HORIZON_SOURCE'),35632)],
   denoise:[convert(screen,35633),convert(g.run('AO_DENOISE_SOURCE'),35632)],
   composition:[convert(screen,35633),convert(g.run(literal(source,'const fs=')),35632)]}};
}
const output={width,height,baseline,before:capture(read(baseline)),after:capture(assemble().html)};
fs.writeFileSync('tests/resultados/revisao-visual-fontes.json',JSON.stringify(output));
console.log(JSON.stringify(Object.fromEntries(['before','after'].map(v=>[v,Object.fromEntries(Object.entries(output[v].scenes).map(([name,s])=>[name,{draws:s.draws.length,triangles:s.triangles}]))])),null,2));
