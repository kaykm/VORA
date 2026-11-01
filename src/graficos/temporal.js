function invertMatrix4(m){
 const rows=Array.from({length:4},(_,r)=>Array.from({length:8},(_,c)=>c<4?m[c*4+r]:(c-4===r?1:0)));
 for(let i=0;i<4;i++){let pivot=i;for(let r=i+1;r<4;r++)if(Math.abs(rows[r][i])>Math.abs(rows[pivot][i]))pivot=r;
  if(Math.abs(rows[pivot][i])<1e-12)return new Float32Array(BODY_IDENTITY);[rows[i],rows[pivot]]=[rows[pivot],rows[i]];
  const f=rows[i][i];for(let c=0;c<8;c++)rows[i][c]/=f;
  for(let r=0;r<4;r++)if(r!==i){const k=rows[r][i];for(let c=0;c<8;c++)rows[r][c]-=rows[i][c]*k;}
 }
 const out=new Float32Array(16);for(let r=0;r<4;r++)for(let c=0;c<4;c++)out[c*4+r]=rows[r][c+4];return out;
}
function halton(index,base){let fraction=1,value=0;while(index>0){fraction/=base;value+=fraction*(index%base);index=Math.floor(index/base)}return value}
function prepareImageFrame(vp){
 const image=lighting?.image;if(!image)return;
 image.taaActive=!!aaProfile().taa;image.excavationMoving=image.lastTravel!==travelDistance||sceneMotionActive;image.lastTravel=travelDistance;
 if(!image.taaActive)return;
 const scene=lighting.scene,pose=[camera.x+cameraPan.x,camera.y+cameraPan.z,viewYaw,viewElevation,smoothZoom],old=image.cameraPose;
 if(old&&(Math.hypot(pose[0]-old[0],pose[1]-old[1])>Math.max(48,smoothZoom*.15)||Math.abs(Math.atan2(Math.sin(pose[2]-old[2]),Math.cos(pose[2]-old[2])))>.3||Math.abs(pose[3]-old[3])>.3||Math.abs(Math.log(pose[4]/old[4]))>.22))image.historyValid=false;
 image.cameraPose=pose;
 const phase=frameCount%8+1,jx=(halton(phase,2)-.5)*2/scene.renderWidth,jy=(halton(phase,3)-.5)*2/scene.renderHeight;
 image.unjitteredVP=new Float32Array(vp);image.jitter=[jx*.5,jy*.5];
 for(let c=0;c<4;c++){vp[c*4]+=jx*vp[c*4+3];vp[c*4+1]+=jy*vp[c*4+3]}
 image.currentVP=new Float32Array(vp);image.inverseVP=invertMatrix4(vp);
}
function runTemporal(source,rw,rh){
 const image=lighting.image,scene=lighting.scene,q=image.temporal,read=image.historyRead,write=1-read,target=scene.history[write];
 const key=rw+':'+rh+':'+state.imageMode;if(image.historyKey!==key){image.historyKey=key;image.historyValid=false}
 bindScreenPass(q,source.texture,target,rw,rh);gl.uniform2f(q.inputViewport,rw,rh);gl.uniform2f(q.resourceSize,source.width,source.height);
 for(const [unit,texture,uniform]of [[1,scene.history[read].texture,q.history],[2,scene.depth,q.depth],[3,scene.color,q.reactive]]){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(uniform,unit)}
 gl.uniformMatrix4fv(q.inverseVP,false,image.inverseVP||BODY_IDENTITY);gl.uniformMatrix4fv(q.previousVP,false,image.historyMatrix||BODY_IDENTITY);gl.uniform1f(q.historyValid,image.historyValid?1:0);
 gl.uniform2f(q.jitter,...(image.jitter||[0,0]));gl.uniform2f(q.previousJitter,...(image.historyJitter||[0,0]));gl.drawArrays(gl.TRIANGLES,0,6);
 image.historyRead=write;image.historyValid=true;image.historyMatrix=new Float32Array(image.currentVP||BODY_IDENTITY);image.historyJitter=Array.from(image.jitter||[0,0]);return target;
}
function bindSourceSize(q,source,rw,rh){gl.uniform2f(q.inputViewport,rw,rh);gl.uniform2f(q.resourceSize,source.width,source.height)}

