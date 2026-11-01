// Coverage and material specialization share production positions and LODs.
// All programs are compiled cooperatively before gameplay, never during render.
const DEPTH_ONLY_FRAGMENT=/* @text src/graficos/shaders/profundidade.frag */;
const opaqueGPU={color:null,depth:null,viewProjection:null,prepassEnabled:false,
 overlap:0,objects:0,triangles:0,colorPasses:0,depthPasses:0};
let shadowCasterPlanes=null;
function opaqueFragmentSource(source=fragmentSource){
 return '#define VORA_OPAQUE_ONLY 1\n'+source
  .replace('uniform float u_material;','const float u_material=14.;')
  .replace('uniform float u_renderPass;','const float u_renderPass=0.;');
}
function extractVisibilityPlanes(matrix,planes){
 planes??=Array.from({length:6},()=>[0,0,0,0]);let i=0;
 for(let axis=0;axis<3;axis++)for(const sign of [-1,1]){
  const p=planes[i++];
  p[0]=matrix[3]+sign*matrix[axis];p[1]=matrix[7]+sign*matrix[4+axis];
  p[2]=matrix[11]+sign*matrix[8+axis];p[3]=matrix[15]+sign*matrix[12+axis];
  const length=Math.hypot(p[0],p[1],p[2]);for(let j=0;j<4;j++)p[j]/=length;
 }return planes;
}
function scenePipelineLocations(program){
 const table={};for(const key of Object.keys(uniforms))table[key]=gl.getUniformLocation(program,'u_'+key);return {program,uniforms:table};
}
function* initOpaquePipelineIncremental(){
 if(gl.isSoftware||!objectInstanceAPI)return;
 const attributes={a_position:attrib.p,a_normal:attrib.n,a_color:attrib.c,
  a_instanceOrigin:attrib.instanceOrigin,a_instanceScale:attrib.instanceScale,a_instanceRotation:attrib.instanceRotation};
 let color=null,depth=null,installed=false;
 try{
  color=yield* linkProgramIncremental(vertexSource,opaqueFragmentSource(),'Otimizando superfícies opacas',true,attributes);
  depth=yield* linkProgramIncremental(vertexSource,DEPTH_ONLY_FRAGMENT,'Preparando cobertura de profundidade',true,attributes);
  opaqueGPU.color=scenePipelineLocations(color);opaqueGPU.depth=scenePipelineLocations(depth);
  // Tile-based mobile GPUs may already remove overdraw in hardware. Keep their
  // specialized color shader, and reserve the extra geometry pass for desktop.
  opaqueGPU.prepassEnabled=!matchMedia('(pointer:coarse)').matches;installed=true;
 }catch(error){console.warn('Mantendo o caminho gráfico compatível:',error);}
 finally{if(!installed){if(color)gl.deleteProgram(color);if(depth)gl.deleteProgram(depth);}}
 gl.useProgram(shaderProgram);
}
function bindOpaqueFrame(pipeline){
 const q=pipeline.uniforms;gl.useProgram(pipeline.program);
 gl.uniformMatrix4fv(q.viewProjection,false,opaqueGPU.viewProjection);
 gl.uniformMatrix4fv(q.bodyRotation,false,BODY_IDENTITY);gl.uniform3f(q.pivot,bodyPivotX,bodyPivotY,bodyPivotZ);
 gl.uniform1f(q.instanced,1);gl.uniform3f(q.tint,1,1,1);
 if(pipeline===opaqueGPU.depth)return q;
 gl.uniform3f(q.hole,player.x,player.y,physicalRadius());gl.uniform1f(q.depth,cavityDepth());gl.uniform1f(q.travel,travelDistance);
 gl.uniform3fv(q.eye,currentEye);gl.uniform1f(q.pixelScale,2*Math.tan(.37)/(lighting?.scene?.renderHeight||canvas.height));
 const phase=travelDistance/26,a2=1.2*Math.sin(phase*.31+.3),a3=Math.sin(phase*.23+1.1)+.9,a4=.8*Math.sin(phase*.19+2.2)+1.7;
 gl.uniform3f(q.apertureSin,Math.sin(a2),Math.sin(a3),Math.sin(a4));gl.uniform3f(q.apertureCos,Math.cos(a2),Math.cos(a3),Math.cos(a4));
 const valid=lighting?.valid&&lighting.fixed.size>1&&state.shadowQuality!=='off';
 gl.uniform1f(q.shadowEnabled,valid?1:0);
 configureShadowBoundsUniforms(q);
 if(valid){
  const profile=shadowProfile();gl.uniformMatrix4fv(q.lightViewProjection,false,lighting.matrix);
  gl.uniform1f(q.shadowQuality,profile.quality);gl.uniform1f(q.shadowSoftness,profile.softness);
  gl.uniform1f(q.shadowDistance,shadowDistanceRange());gl.uniform2f(q.shadowCenter,camera.x+cameraPan.x,camera.y+cameraPan.z);
  gl.uniform1f(q.shadowDepthRange,lighting.depthRange);gl.uniform1f(q.staticShadowTexel,1/lighting.fixed.size);gl.uniform1f(q.shadowTexel,1/lighting.moving.size);
  gl.uniform1f(q.staticShadowWorldTexel,lighting.extent*2/lighting.fixed.size);
  gl.uniform1f(q.shadowWorldTexel,lighting.liveWindow[2]*lighting.extent*2/lighting.moving.size);
  gl.uniform4f(q.liveShadowWindow,...lighting.liveWindow);gl.uniform1i(q.staticShadowMap,2);gl.uniform1i(q.shadowMap,3);
 }
 return q;
}
function opaquePrepassWorthwhile(groups=objectInstanceGroups){
 if(!opaqueGPU.prepassEnabled||!opaqueGPU.depth||renderingShadow)return false;
 let area=0,objects=0,triangles=0;const pixels=W*H,projection=H/(2*Math.tan(.37));
 for(const group of groups){
  objects+=group.count;triangles+=group.count*group.mesh.count/3;
  const sphere=group.mesh.sphere;if(!sphere)continue;
  for(let n=0;n<group.count;n++){
   const i=n*7,data=group.data,radius=sphere[3]*Math.max(data[i+3],data[i+4],data[i+5]);
   const distance=Math.hypot(data[i]-currentEye[0],data[i+1]+sphere[1]*data[i+4]-currentEye[1],data[i+2]-currentEye[2]);
   const projected=projection*radius/Math.max(2,distance-radius);area+=Math.min(pixels,Math.PI*projected*projected);
  }
 }
 opaqueGPU.overlap=area/Math.max(1,pixels);opaqueGPU.objects=objects;opaqueGPU.triangles=triangles;
 return objects>=24&&opaqueGPU.overlap>1.5&&triangles<900000;
}
