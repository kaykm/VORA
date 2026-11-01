function updateMesh(existing,data){const values=data instanceof Float32Array?data:new Float32Array(data);if(!existing){existing=mesh(values,true);existing.capacity=values.length;return existing}gl.bindBuffer(gl.ARRAY_BUFFER,existing.buffer);if(gl.bufferSubData&&existing.capacity===values.length)gl.bufferSubData(gl.ARRAY_BUFFER,0,values);else{gl.bufferData(gl.ARRAY_BUFFER,values,gl.DYNAMIC_DRAW||gl.STATIC_DRAW);existing.capacity=values.length}existing.count=values.length/9;return existing}
let cavityBuffers=null;
function makeCavityBuffers(){
 // Broad, readable facets match the park. Keep one continuous set of rings so
 // the lip, wall and floor share their boundaries at every upgrade level.
 const N=48,rows=[];
 for(let i=0;i<=2;i++)rows.push({section:'outer',u:i/2});
 for(let i=1;i<=3;i++)rows.push({section:'roll',u:i/3});
 for(let i=1;i<=6;i++)rows.push({section:'wall',u:i/6});
 for(let i=1;i<=4;i++)rows.push({section:'floor',u:i/4});
 const lists={rim:[],wall:[],floor:[]};for(let j=0;j<rows.length-1;j++)for(let i=0;i<N;i++){const next=(i+1)%N,out=rows[j+1].section==='floor'?lists.floor:rows[j+1].section==='wall'?lists.wall:lists.rim;out.push(j*N+i,(j+1)*N+i,j*N+next);if(j<rows.length-2)out.push(j*N+next,(j+1)*N+i,(j+1)*N+next)}
 const parts={};for(const name of ['rim','wall','floor']){const indices=new Uint16Array(lists[name]),data=new Float32Array(indices.length*9);for(let i=0;i<indices.length;i++)data.fill(1,i*9+6,i*9+9);parts[name]={indices,data}}
 for(const row of rows){
  const u=row.u,v=1-u,v2=v*v,u2=u*u;
  row.outerHeight=quintic(u);row.rollSin=Math.sin(u*Math.PI/2);row.rollCos=Math.cos(u*Math.PI/2);
  row.a=v2*v;row.b=3*v2*u;row.c=3*v*u2;row.d=u2*u;row.envelope=16*u2*v2;
  row.duA=6*v*u;row.duB=3*u2;row.duWave=32*u*v*(v-u);row.dyA=3*v2;row.foldA=u*3.2;row.foldB=u*2.4;
 }
 return {N,rows,parts,centerSample:new Float64Array(3),points:new Float64Array(rows.length*N*3),normals:new Float32Array(rows.length*N*3),tangents:new Float32Array(rows.length*N*3),angles:Array.from({length:N},(_,i)=>i/N*Math.PI*2)};
}
function sampleGeometryWall(p,row,out){
 const a=p.fold3+row.foldA,b=p.fold5-row.foldB;
 const wave=p.amplitude*(Math.sin(a)*.62+Math.sin(b)*.38);
 out[0]=row.a*p.start+row.b*p.start+row.c*p.r2+row.d*p.end+row.envelope*wave;
 out[1]=row.a*p.y0+row.b*p.y1+row.c*p.y2+row.d*p.y3;
 out[2]=row.duA*(p.r2-p.start)+row.duB*(p.end-p.r2)+row.duWave*wave+row.envelope*p.amplitude*(3.2*Math.cos(a)*.62-2.4*Math.cos(b)*.38);
 out[3]=row.dyA*(p.y1-p.y0)+row.duA*(p.y2-p.y1)+row.duB*(p.y3-p.y2);
 return out;
}
function rebuildCavity(){
 const k=player.x.toFixed(2)+':'+player.y.toFixed(2)+':'+physicalRadius().toFixed(3)+':'+cavityDepth().toFixed(3)+':'+cavityVisual.level.toFixed(5)+':'+cavityVisual.elevation.toFixed(3)+':'+Math.floor(travelDistance*3);if(k===geometryKey)return;geometryKey=k;
 const b=cavityBuffers??=makeCavityBuffers(),{N,rows,points,normals,tangents,parts}=b,ctx=cavityContext();
 sampleBasin(0,0,ctx,b.centerSample);
 for(let i=0;i<N;i++){const p=angularProfile(b.angles[i],ctx);for(let j=0;j<rows.length;j++){const row=rows[j],u=row.u,idx=(j*N+i)*3;let rho,y,dr=0,dy=0,sampledFloor=false;if(row.section==='outer'){rho=p.opening+p.width-(p.width-p.peak)*u;y=p.height*row.outerHeight;dr=-(p.width-p.peak)}else if(row.section==='roll'){rho=p.opening+p.peak-(p.peak+p.inset)*row.rollSin;y=p.height-(p.height+p.drop)*(1-row.rollCos);dr=-(p.peak+p.inset)*Math.PI*.5*row.rollCos;dy=-(p.height+p.drop)*Math.PI*.5*row.rollSin}else if(row.section==='wall'){sampleGeometryWall(p,row,wallGeometryScratch);rho=wallGeometryScratch[0];y=wallGeometryScratch[1];dr=wallGeometryScratch[2];dy=wallGeometryScratch[3]}else{rho=p.end*(1-u);if(u===1)basinScratch.set(b.centerSample);else sampleBasin(p.c*rho,p.s*rho,ctx,basinScratch);y=basinScratch[0];sampledFloor=true}points[idx]=p.c*rho;points[idx+1]=row.section==='outer'?liftTerrainAt(player.x+points[idx],player.y+p.s*rho,y):liftCavityAt(y,p);points[idx+2]=p.s*rho;
  // Exact profile tangents keep the lighting smooth across unequal row spacing.
  if(j>0&&row.section!=='floor'&&!(row.section==='wall'&&u===1)){
   const t=Math.max(0,Math.min(1,-y/p.blendDepth)),liftSlope=1+(p.surface-ctx.elevation)*6*t*(1-t)/p.blendDepth;
   tangents[idx]=p.c*dr;tangents[idx+1]=dy*liftSlope;tangents[idx+2]=p.s*dr;
  }
  if(j===0){normals[idx]=0;normals[idx+1]=1;normals[idx+2]=0}else if(row.section==='floor'||row.section==='wall'&&u===1){const dx=sampledFloor?basinScratch[1]:p.endDX,dz=sampledFloor?basinScratch[2]:p.endDZ,len=Math.hypot(dx,1,dz);normals[idx]=-dx/len;normals[idx+1]=1/len;normals[idx+2]=-dz/len}
 }}
 for(let j=1;j<rows.length;j++){if(rows[j].section==='floor'||rows[j].section==='wall'&&rows[j].u===1)continue;for(let i=0;i<N;i++){const idx=(j*N+i)*3,before=((j-1)*N+i)*3,after=((j+1)*N+i)*3,left=(j*N+(i+N-1)%N)*3,right=(j*N+(i+1)%N)*3,analytic=rows[j].section!=='outer'||rows[j].u===1,dx=analytic?tangents[idx]:points[after]-points[before],dy=analytic?tangents[idx+1]:points[after+1]-points[before+1],dz=analytic?tangents[idx+2]:points[after+2]-points[before+2],ax=points[right]-points[left],ay=points[right+1]-points[left+1],az=points[right+2]-points[left+2],nx=dy*az-dz*ay,ny=dz*ax-dx*az,nz=dx*ay-dy*ax,len=Math.hypot(nx,ny,nz)||1;normals[idx]=nx/len;normals[idx+1]=ny/len;normals[idx+2]=nz/len}}
 uploadCavityMeshes(b);
 if(!rootMesh){rootMesh=mesh([]);fragmentMesh=mesh([]);grassMesh=mesh([])}
}

