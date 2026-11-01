// Instanced submission preserves each production mesh, transform and LOD. It is
// optional: WebGL 1 without ANGLE, physical cargo and SoftwareGL keep drawMesh.
let objectInstanceAPI=null,collectObjectInstances=false,objectInstanceSerial=0;
const objectInstanceGroups=[];
const instanceSubmission={draws:0,objects:0,bytes:0};
function initObjectInstancing(){
 if(gl.isSoftware)return;
 if(typeof gl.drawElementsInstanced==='function'&&typeof gl.vertexAttribDivisor==='function'){
  objectInstanceAPI={
   divisor:(i,n)=>gl.vertexAttribDivisor(i,n),
   arrays:(first,count,n)=>gl.drawArraysInstanced(gl.TRIANGLES,first,count,n),
   elements:(first,count,n)=>gl.drawElementsInstanced(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,first*2,n)
  };
 }else{
  const extension=gl.getExtension?.('ANGLE_instanced_arrays');if(!extension)return;
  objectInstanceAPI={
   divisor:(i,n)=>extension.vertexAttribDivisorANGLE(i,n),
   arrays:(first,count,n)=>extension.drawArraysInstancedANGLE(gl.TRIANGLES,first,count,n),
   elements:(first,count,n)=>extension.drawElementsInstancedANGLE(gl.TRIANGLES,count,gl.UNSIGNED_SHORT,first*2,n)
  };
 }
 attrib.instanceOrigin=gl.getAttribLocation(shaderProgram,'a_instanceOrigin');
 attrib.instanceScale=gl.getAttribLocation(shaderProgram,'a_instanceScale');
 attrib.instanceRotation=gl.getAttribLocation(shaderProgram,'a_instanceRotation');
 if([attrib.instanceOrigin,attrib.instanceScale,attrib.instanceRotation].some(i=>i<0))objectInstanceAPI=null;
 gl.uniform1f(uniforms.instanced,0);
}
function configureInstanceAttributes(group){
 gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);
 for(const [location,size,offset]of [[attrib.instanceOrigin,3,0],[attrib.instanceScale,3,12],[attrib.instanceRotation,1,24]]){
  gl.enableVertexAttribArray(location);gl.vertexAttribPointer(location,size,gl.FLOAT,false,28,offset);objectInstanceAPI.divisor(location,1);
 }
}
function objectInstanceGroup(m,reactive){
 const groups=m.instanceGroups??=[];let group=groups[reactive];if(group)return group;
 const buffer=gl.createBuffer();if(!buffer)return null;
 group={mesh:m,reactive,buffer,vao:null,capacity:64,count:0,serial:-1,data:new Float32Array(64*7)};
 gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,group.data.byteLength,gl.DYNAMIC_DRAW);
 if(geometryVAO){
  group.vao=geometryVAO.create();
  if(group.vao){
   geometryVAO.bind(group.vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);geometryAttributes();
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indexBuffer||null);configureInstanceAttributes(group);geometryVAO.bind(null);
  }
 }
 boundGeometry=null;groups[reactive]=group;return group;
}
function prepareObjectInstances(m){
 if(objectInstanceAPI){objectInstanceGroup(m,0);objectInstanceGroup(m,1);}return m;
}
function releaseObjectInstances(m){
 for(const group of m.instanceGroups||[]){if(!group)continue;if(group.vao)geometryVAO?.remove(group.vao);gl.deleteBuffer(group.buffer);}
 m.instanceGroups=null;
}
function beginObjectInstances(){
 if(!objectInstanceAPI)return false;
 objectInstanceGroups.length=0;objectInstanceSerial++;collectObjectInstances=true;return true;
}
function queueObjectInstance(m,x,y,z,sx,sy,sz,rotation,reactive){
 const group=objectInstanceGroup(m,reactive);if(!group)return false;
 if(group.serial!==objectInstanceSerial){group.serial=objectInstanceSerial;group.count=0;objectInstanceGroups.push(group);}
 if(group.count===group.capacity){
  group.capacity*=2;const data=new Float32Array(group.capacity*7);data.set(group.data);group.data=data;
  gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);gl.bufferData(gl.ARRAY_BUFFER,data.byteLength,gl.DYNAMIC_DRAW);
 }
 const data=group.data,i=group.count++*7;
 data[i]=x;data[i+1]=y;data[i+2]=z;data[i+3]=sx;data[i+4]=sy;data[i+5]=sz;data[i+6]=rotation;return true;
}
function drawObjectInstanceGroups(q){
 for(const group of objectInstanceGroups){
  const m=group.mesh;
  if(group.vao)geometryVAO.bind(group.vao);
  else{
   geometryVAO?.bind(null);gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);geometryAttributes();
   gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indexBuffer||null);configureInstanceAttributes(group);
  }
  gl.uniform1f(q.reactive,group.reactive);
  if(m.indexBuffer)objectInstanceAPI.elements(m.first||0,m.count,group.count);
  else objectInstanceAPI.arrays(m.first||0,m.count,group.count);
  instanceSubmission.draws++;instanceSubmission.objects+=group.count;
  if(!group.vao)for(const location of [attrib.instanceOrigin,attrib.instanceScale,attrib.instanceRotation]){
   objectInstanceAPI.divisor(location,0);gl.disableVertexAttribArray(location);
  }
 }
}
function endObjectInstances(){
 if(!collectObjectInstances)return;collectObjectInstances=false;
 if(!objectInstanceGroups.length)return;
 const specialized=!renderingShadow&&opaqueGPU.color&&opaqueGPU.viewProjection;
 const depthPrepass=specialized&&opaquePrepassWorthwhile();
 try{
  // Upload once. Both passes consume the same VBO contents and positions.
  for(const group of objectInstanceGroups){
   gl.bindBuffer(gl.ARRAY_BUFFER,group.buffer);const values=group.data.subarray(0,group.count*7);
   gl.bufferSubData(gl.ARRAY_BUFFER,0,values);instanceSubmission.bytes+=values.byteLength;
  }
  if(depthPrepass){
   const q=bindOpaqueFrame(opaqueGPU.depth);
   gl.colorMask(false,false,false,false);gl.depthMask(true);gl.depthFunc(gl.LEQUAL);
   drawObjectInstanceGroups(q);opaqueGPU.depthPasses++;
   gl.colorMask(true,true,true,true);gl.depthFunc(gl.EQUAL);gl.depthMask(false);
  }
  let q=uniforms;
  if(specialized){q=bindOpaqueFrame(opaqueGPU.color);opaqueGPU.colorPasses++;}
  else{gl.uniform1f(q.instanced,1);gl.uniform1f(q.material,14);gl.uniform3f(q.tint,1,1,1);}
  drawObjectInstanceGroups(q);
 }finally{
  if(depthPrepass){gl.colorMask(true,true,true,true);gl.depthMask(true);gl.depthFunc(gl.LEQUAL);}
  gl.useProgram(shaderProgram);geometryVAO?.bind(null);boundGeometry=null;meshUniformState.fill(NaN);
  gl.uniform1f(uniforms.instanced,0);objectInstanceGroups.length=0;
 }
}
