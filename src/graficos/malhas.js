// Lossless submission optimizations: identical triangles, materials and LOD thresholds.
const geometryVAO=(()=>{
 if(gl.isSoftware)return null;
 if(WEBGL2&&typeof gl.createVertexArray==='function')return {create:()=>gl.createVertexArray(),bind:v=>gl.bindVertexArray(v),remove:v=>gl.deleteVertexArray(v)};
 const e=gl.getExtension?.('OES_vertex_array_object');return e?{create:()=>e.createVertexArrayOES(),bind:v=>e.bindVertexArrayOES(v),remove:v=>e.deleteVertexArrayOES(v)}:null;
})();
const nativeDepthBits=gl.isSoftware?0:gl.getParameter(gl.DEPTH_BITS);
const meshUniformState=new Float64Array(14).fill(NaN);
let boundGeometry=null,currentBodyRotation=BODY_IDENTITY,bodyPivotX=0,bodyPivotY=0,bodyPivotZ=0;
function setBodyRotation(matrix){currentBodyRotation=matrix;gl.uniformMatrix4fv(uniforms.bodyRotation,false,matrix)}
function setBodyPivot(x,y,z){bodyPivotX=x;bodyPivotY=y;bodyPivotZ=z;gl.uniform3f(uniforms.pivot,x,y,z)}
function geometryAttributes(){
 gl.enableVertexAttribArray(attrib.p);gl.vertexAttribPointer(attrib.p,3,gl.FLOAT,false,36,0);
 gl.enableVertexAttribArray(attrib.n);gl.vertexAttribPointer(attrib.n,3,gl.FLOAT,false,36,12);
 gl.enableVertexAttribArray(attrib.c);gl.vertexAttribPointer(attrib.c,3,gl.FLOAT,false,36,24);
}
function bindGeometry(m){
 m=m.geometry||m;
 if(gl.isSoftware){gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);return}
 if(boundGeometry===m)return;
 if(geometryVAO){
  if(!m.vao){m.vao=geometryVAO.create();if(m.vao){geometryVAO.bind(m.vao);gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);geometryAttributes();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indexBuffer||null)}}
  if(m.vao){geometryVAO.bind(m.vao);boundGeometry=m;return}
  geometryVAO.bind(null);
 }
 gl.bindBuffer(gl.ARRAY_BUFFER,m.buffer);geometryAttributes();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,m.indexBuffer||null);boundGeometry=m;
}
function deleteMesh(m){
 if(!m)return;if(m.parts&&!m.buffer){for(const p of m.parts)deleteMesh(p);return}
 releaseObjectInstances(m);
 if(boundGeometry===m){geometryVAO?.bind(null);boundGeometry=null}
 if(m.vao)geometryVAO?.remove(m.vao);if(m.indexBuffer)gl.deleteBuffer(m.indexBuffer);gl.deleteBuffer(m.buffer);
}
function meshSphere(data){
 if(!data.length)return null;
 let ax=Infinity,ay=Infinity,az=Infinity,bx=-Infinity,by=-Infinity,bz=-Infinity;
 for(let i=0;i<data.length;i+=9){const x=data[i],y=data[i+1],z=data[i+2];ax=Math.min(ax,x);ay=Math.min(ay,y);az=Math.min(az,z);bx=Math.max(bx,x);by=Math.max(by,y);bz=Math.max(bz,z)}
 return [(ax+bx)*.5,(ay+by)*.5,(az+bz)*.5,Math.hypot(bx-ax,by-ay,bz-az)*.5+.001];
}
function mesh(data,dynamic=false){
 let vertices=data instanceof Float32Array?data:new Float32Array(data),indices=null;const count=vertices.length/9,sphere=dynamic?null:meshSphere(vertices);
 // Exact Float32 bit keys preserve hard normals, material tags and all seams.
 if(!gl.isSoftware&&!dynamic&&count>=96&&typeof gl.drawElements==='function'){
  const bits=new Uint32Array(vertices.buffer,vertices.byteOffset,vertices.length),seen=new Map(),unique=[],order=new Uint16Array(count);let overflow=false;
  for(let i=0;i<count;i++){
   const k=i*9,key=bits[k]+','+bits[k+1]+','+bits[k+2]+','+bits[k+3]+','+bits[k+4]+','+bits[k+5]+','+bits[k+6]+','+bits[k+7]+','+bits[k+8];let index=seen.get(key);
   if(index===undefined){index=unique.length/9;if(index>=65535){overflow=true;break}seen.set(key,index);for(let j=0;j<9;j++)unique.push(vertices[k+j])}order[i]=index;
  }
  if(!overflow&&unique.length*4+order.byteLength<vertices.byteLength*.92){vertices=new Float32Array(unique);indices=order}
 }
 const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,vertices,dynamic?(gl.DYNAMIC_DRAW||gl.STATIC_DRAW):gl.STATIC_DRAW);
 let indexBuffer=null;if(indices){geometryVAO?.bind(null);boundGeometry=null;indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,indices,gl.STATIC_DRAW);gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,null)}
 return {buffer,count,indexBuffer,sphere,vertexCount:vertices.length/9,
  vertexByteLength:vertices.byteLength,indexByteLength:indices?.byteLength||0,
  byteLength:vertices.byteLength+(indices?.byteLength||0)};
}

// Cooperative builders use the same Float32 values, vertex order and exact-bit
// deduplication as mesh(). The scheduler may stop after any yield and resume on
// another frame. No mesh is visible to rendering before the generator returns.
function* meshVerticesIncremental(data) {
 if (data instanceof Float32Array) return data;
 const vertices = new Float32Array(data.length), block = 256 * 9;
 for (let start = 0; start < data.length; start += block) {
  const end = Math.min(data.length, start + block);
  for (let i = start; i < end; i++) vertices[i] = data[i];
  yield {stage:'vertices',completed:end,total:data.length};
 }
 return vertices;
}

function* meshSphereIncremental(data) {
 if (!data.length) return null;
 let ax=Infinity,ay=Infinity,az=Infinity,bx=-Infinity,by=-Infinity,bz=-Infinity;
 let processed = 0;
 for (let i = 0; i < data.length; i += 9) {
  const x=data[i],y=data[i+1],z=data[i+2];
  ax=Math.min(ax,x);ay=Math.min(ay,y);az=Math.min(az,z);
  bx=Math.max(bx,x);by=Math.max(by,y);bz=Math.max(bz,z);
  if (++processed % 256 === 0) yield {stage:'bounds',completed:i+9,total:data.length};
 }
 return [(ax+bx)*.5,(ay+by)*.5,(az+bz)*.5,Math.hypot(bx-ax,by-ay,bz-az)*.5+.001];
}

function* uploadMeshBufferIncremental(target, data, usage) {
 let buffer = null, completed = false;
 const bind = () => {
  // Rendering may have bound another VAO/buffer since the previous yield.
  geometryVAO?.bind(null);
  boundGeometry = null;
  gl.bindBuffer(target, buffer);
 };
 try {
  buffer = gl.createBuffer();
  bind();
  if (gl.isSoftware || typeof gl.bufferSubData !== 'function') {
   gl.bufferData(target, data, usage);
  } else {
   gl.bufferData(target, data.byteLength, usage);
   gl.bindBuffer(target, null);
   yield {stage:'allocate',completed:0,total:data.byteLength};
   const block = Math.max(1, Math.floor(128 * 1024 / data.BYTES_PER_ELEMENT));
   for (let start = 0; start < data.length; start += block) {
    const end = Math.min(data.length, start + block);
    bind();
    gl.bufferSubData(target, start * data.BYTES_PER_ELEMENT, data.subarray(start, end));
    gl.bindBuffer(target, null);
    yield {stage:'upload',completed:end*data.BYTES_PER_ELEMENT,total:data.byteLength};
   }
  }
  gl.bindBuffer(target, null);
  completed = true;
  return buffer;
 } finally {
  // iterator.return() also reaches this cleanup while an upload is suspended.
  if (!completed && buffer) gl.deleteBuffer(buffer);
 }
}

function* meshIncremental(data, dynamic = false) {
 let vertices = yield* meshVerticesIncremental(data);
 const count = vertices.length / 9;
 const sphere = dynamic ? null : yield* meshSphereIncremental(vertices);
 let indices = null, buffer = null, indexBuffer = null, completed = false;
 try {
  if (!gl.isSoftware && !dynamic && count >= 96 && typeof gl.drawElements === 'function') {
   const bits = new Uint32Array(vertices.buffer, vertices.byteOffset, vertices.length);
   const seen = new Map(), unique = [], order = new Uint16Array(count);
   let overflow = false;
   for (let i = 0; i < count; i++) {
    const k=i*9;
    const key=bits[k]+','+bits[k+1]+','+bits[k+2]+','+bits[k+3]+','+bits[k+4]+','+bits[k+5]+','+bits[k+6]+','+bits[k+7]+','+bits[k+8];
    let index = seen.get(key);
    if (index === undefined) {
     index = unique.length / 9;
     if (index >= 65535) { overflow = true; break; }
     seen.set(key, index);
     for (let j = 0; j < 9; j++) unique.push(vertices[k+j]);
    }
    order[i] = index;
    if ((i+1) % 256 === 0) yield {stage:'deduplicate',completed:i+1,total:count};
   }
   if (!overflow && unique.length*4+order.byteLength < vertices.byteLength*.92) {
    vertices = yield* meshVerticesIncremental(unique);
    indices = order;
   }
   seen.clear();
   unique.length = 0;
  }
  // Upload is separated from the CPU work and split into bounded transfers.
  yield {stage:'ready-upload',completed:0,total:vertices.byteLength+(indices?.byteLength||0)};
  buffer = yield* uploadMeshBufferIncremental(gl.ARRAY_BUFFER, vertices,
   dynamic ? (gl.DYNAMIC_DRAW||gl.STATIC_DRAW) : gl.STATIC_DRAW);
  if (indices) indexBuffer = yield* uploadMeshBufferIncremental(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW);
  completed = true;
  return {buffer,count,indexBuffer,sphere,vertexCount:vertices.length/9,
   vertexByteLength:vertices.byteLength,indexByteLength:indices?.byteLength||0,
   byteLength:vertices.byteLength+(indices?.byteLength||0)};
 } finally {
  if (!completed) {
   if (indexBuffer) gl.deleteBuffer(indexBuffer);
   if (buffer) gl.deleteBuffer(buffer);
  }
 }
}

function partitionStaticMesh(data,span=128){
 if(gl.isSoftware)return mesh(data);
 const tiles=new Map();for(let i=0;i<data.length;i+=27){const x=Math.floor((data[i]+data[i+9]+data[i+18])/(span*3)),z=Math.floor((data[i+2]+data[i+11]+data[i+20])/(span*3)),key=x+':'+z;let tile=tiles.get(key);if(!tile)tiles.set(key,tile=[]);for(let j=0;j<27;j++)tile.push(data[i+j])}
 const packed=new Float32Array(data.length),ranges=[];let start=0;
 for(const tile of tiles.values()){packed.set(tile,start);ranges.push({first:start/9,count:tile.length/9,sphere:meshSphere(tile)});start+=tile.length}
 const parent=mesh(packed);parent.parts=ranges.map(p=>({...p,buffer:parent.buffer,indexBuffer:parent.indexBuffer,geometry:parent}));return parent;
}

function* partitionStaticMeshIncremental(data, span = 128) {
 if (gl.isSoftware) return yield* meshIncremental(data);
 const tiles = new Map();
 let processed = 0, parent = null, completed = false;
 try {
  for (let i = 0; i < data.length; i += 27) {
   const x=Math.floor((data[i]+data[i+9]+data[i+18])/(span*3));
   const z=Math.floor((data[i+2]+data[i+11]+data[i+20])/(span*3));
   const key=x+':'+z;
   let tile=tiles.get(key);
   if (!tile) tiles.set(key,tile=[]);
   for (let j = 0; j < 27; j++) tile.push(data[i+j]);
   if (++processed % 128 === 0) yield {stage:'partition',completed:i+27,total:data.length};
  }
  const packed = new Float32Array(data.length), ranges = [];
  let start = 0;
  for (const [key,tile] of tiles) {
   const block = 256 * 9;
   for (let offset = 0; offset < tile.length; offset += block) {
    const end = Math.min(tile.length, offset + block);
    for (let i = offset; i < end; i++) packed[start+i] = tile[i];
    yield {stage:'pack',completed:start+end,total:data.length};
   }
   ranges.push({first:start/9,count:tile.length/9,sphere:yield* meshSphereIncremental(tile)});
   start += tile.length;
   tiles.delete(key);
  }
  parent = yield* meshIncremental(packed);
  parent.parts = [];
  for (let i = 0; i < ranges.length; i++) {
   // These ranges share the parent's allocations; they own no extra GPU bytes.
   parent.parts.push({...ranges[i],buffer:parent.buffer,indexBuffer:parent.indexBuffer,
    geometry:parent,byteLength:0});
   if ((i+1) % 128 === 0) yield {stage:'ranges',completed:i+1,total:ranges.length};
  }
  completed = true;
  return parent;
 } finally {
  tiles.clear();
  if (!completed && parent) deleteMesh(parent);
 }
}
function makeWalkTiles(data){return partitionStaticMesh(data,128)}
function meshVisibility(m,x,y,z,sx,sy,sz,rot){
 // Shadows use the light's volume, never the camera's: offscreen casters remain.
 const planes=renderingShadow?shadowCasterPlanes:vegetationPlanes;
 if(gl.isSoftware||!m.sphere||!planes)return 2;
 const s=m.sphere,c=rot?Math.cos(rot):1,n=rot?Math.sin(rot):0,lx=s[0]*sx,lz=s[2]*sz;
 let X=x+c*lx+n*lz,Y=y+s[1]*sy,Z=z-n*lx+c*lz;
 if(currentBodyRotation!==BODY_IDENTITY){const q=currentBodyRotation,px=X-bodyPivotX,py=Y-bodyPivotY,pz=Z-bodyPivotZ;X=q[0]*px+q[4]*py+q[8]*pz+bodyPivotX;Y=q[1]*px+q[5]*py+q[9]*pz+bodyPivotY;Z=q[2]*px+q[6]*py+q[10]*pz+bodyPivotZ}
 const radius=s[3]*Math.max(sx,sy,sz)+.05;let classification=2;
 for(const p of planes){const distance=p[0]*X+p[1]*Y+p[2]*Z+p[3];if(distance< -radius)return 0;if(distance<radius)classification=1}return classification;
}
function drawMesh(m,x,y,z,sx=1,sy=1,sz=1,tint=[1,1,1],material=0,rot=0){
 if(!m?.count)return;
 if(m.parts){
  const visibility=objectTransform?1:meshVisibility(m,x,y,z,sx,sy,sz,rot);if(!visibility)return;
  if(visibility!==2){
   const visible=m.visibleParts??=[];visible.length=0;let vertices=0;
   for(const part of m.parts)if(objectTransform||meshVisibility(part,x,y,z,sx,sy,sz,rot)){visible.push(part);vertices+=part.count}
   if(!vertices)return;
   // Partial submission is worthwhile only if it actually removes substantial geometry.
   // Drawing the intact parent is cheaper when most/all of its subtiles are visible.
   if(vertices<m.count*.80){drawStaticRanges(m,visible,x,y,z,sx,sy,sz,tint,material,rot);return}
  }
 }
 if(objectTransform){const p=objectTransform;x=p.x+(x-p.x)*p.sx;y=p.y+(y-p.y)*p.sy;z=p.z+(z-p.z)*p.sz;sx*=p.sx;sy*=p.sy;sz*=p.sz}
 sx=Math.max(.001,sx);sy=Math.max(.001,sy);sz=Math.max(.001,sz);
 if(!meshVisibility(m,x,y,z,sx,sy,sz,rot))return;
 const reactive=lighting?.image?.taaActive&&(reactiveDraw||material===16||((material===2||material===3||material===4)&&lighting.image.excavationMoving)||objectTransform&&(objectTransform.sx!==1||objectTransform.sy!==1||objectTransform.sz!==1))?1:0;
 if(collectObjectInstances&&material===14&&currentBodyRotation===BODY_IDENTITY&&tint[0]===1&&tint[1]===1&&tint[2]===1&&!m.parts){
  if(queueObjectInstance(m,x,y,z,sx,sy,sz,rot,reactive))return;
 }
 bindGeometry(m);const u=meshUniformState;
 if(u[0]!==x||u[1]!==y||u[2]!==z){gl.uniform3f(uniforms.origin,x,y,z);u[0]=x;u[1]=y;u[2]=z}
 if(u[3]!==sx||u[4]!==sy||u[5]!==sz){gl.uniform3f(uniforms.scale,sx,sy,sz);u[3]=sx;u[4]=sy;u[5]=sz}
 if(u[6]!==rot){gl.uniform1f(uniforms.rotation,rot);u[6]=rot}
 if(u[7]!==tint[0]||u[8]!==tint[1]||u[9]!==tint[2]){gl.uniform3fv(uniforms.tint,tint);u[7]=tint[0];u[8]=tint[1];u[9]=tint[2]}
 if(u[10]!==material){gl.uniform1f(uniforms.material,material);u[10]=material}
 if(u[11]!==reactive){gl.uniform1f(uniforms.reactive,reactive);u[11]=reactive}
 if(m.indexBuffer)gl.drawElements(gl.TRIANGLES,m.count,gl.UNSIGNED_SHORT,(m.first||0)*2);else gl.drawArrays(gl.TRIANGLES,m.first||0,m.count);
}
function shadeCavityFacets(data){
 // SoftwareGL has no screen derivatives. Use the triangle's own normal there,
 // matching gSurfaceNormal in the hardware shader without expanding GPU data.
 for(let i=0;i<data.length;i+=27){
  const ax=data[i+9]-data[i],ay=data[i+10]-data[i+1],az=data[i+11]-data[i+2];
  const bx=data[i+18]-data[i],by=data[i+19]-data[i+1],bz=data[i+20]-data[i+2];
  let nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
  const length=Math.hypot(nx,ny,nz);if(length<1e-10)continue;
  const direction=nx*data[i+3]+ny*data[i+4]+nz*data[i+5]<0?-1:1;
  nx*=direction/length;ny*=direction/length;nz*=direction/length;
  for(let k=0;k<27;k+=9){data[i+k+3]=nx;data[i+k+4]=ny;data[i+k+5]=nz;}
 }
}
function uploadCavityMeshes(b){
 if(gl.isSoftware){for(const name of ['rim','wall','floor']){const {indices,data}=b.parts[name];for(let i=0;i<indices.length;i++){const v=indices[i]*3,k=i*9;for(let j=0;j<3;j++){data[k+j]=b.points[v+j];data[k+3+j]=b.normals[v+j]}}}
  shadeCavityFacets(b.parts.wall.data);shadeCavityFacets(b.parts.floor.data);
  rimMesh=updateMesh(rimMesh,b.parts.rim.data);wallMesh=updateMesh(wallMesh,b.parts.wall.data);floorMesh=updateMesh(floorMesh,b.parts.floor.data);return;
 }
 if(!b.vertexData){b.vertexData=new Float32Array(b.N*b.rows.length*9);for(let i=6;i<b.vertexData.length;i+=9)b.vertexData.fill(1,i,i+3)}
 for(let i=0;i<b.points.length/3;i++){const v=i*3,k=i*9;for(let j=0;j<3;j++){b.vertexData[k+j]=b.points[v+j];b.vertexData[k+3+j]=b.normals[v+j]}}
 if(!b.gpu){b.gpu=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b.gpu);gl.bufferData(gl.ARRAY_BUFFER,b.vertexData,gl.DYNAMIC_DRAW);
  geometryVAO?.bind(null);boundGeometry=null;
  for(const name of ['rim','wall','floor']){const p=b.parts[name];p.indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,p.indexBuffer);gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,p.indices,gl.STATIC_DRAW);p.mesh={buffer:b.gpu,indexBuffer:p.indexBuffer,count:p.indices.length}}
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,null);
 }else{gl.bindBuffer(gl.ARRAY_BUFFER,b.gpu);gl.bufferSubData(gl.ARRAY_BUFFER,0,b.vertexData)}
 rimMesh=b.parts.rim.mesh;wallMesh=b.parts.wall.mesh;floorMesh=b.parts.floor.mesh;
}
