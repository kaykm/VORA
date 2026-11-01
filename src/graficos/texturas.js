// Directional sunlight and a single depth-texture scene pass. All assets stay offline.
let renderingShadow=false,lighting=null,reactiveDraw=false;
function orthographic(left,right,bottom,top,near,far){return new Float32Array([2/(right-left),0,0,0,0,2/(top-bottom),0,0,0,0,-2/(far-near),0,-(right+left)/(right-left),-(top+bottom)/(top-bottom),-(far+near)/(far-near),1])}
function colorTexture(width,height,filter){
 const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,filter);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,filter);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);return t;
}

function makeTurfTexture(){
 return drainGpuPreparation(makeTurfTextureIncremental());
}
function* makeTurfTextureIncremental(){
 const N=512,mask=N-1,pixels=N*N,cover=new Float32Array(pixels),tip=new Float32Array(pixels),gx=new Float32Array(pixels),gz=new Float32Array(pixels);
 for(let layer=0;layer<2;layer++){
  const cells=layer?27:20,unit=N/cells;
  for(let z=0;z<cells;z++)for(let x=0;x<cells;x++){
   const h=materialHash(x+layer*17.1,z+3.7),j=materialHash(x+32.1,z+layer*41.3),a=h*Math.PI*2,c=Math.cos(a),sn=Math.sin(a);
   const cx=(x+.5+(h-.5)*.52)*unit,cz=(z+.5+(j-.5)*.52)*unit,r=Math.ceil(unit*.74),aa=.65/unit;
   for(let Z=Math.floor(cz-r);Z<=Math.ceil(cz+r);Z++)for(let X=Math.floor(cx-r);X<=Math.ceil(cx+r);X++){
    const dx=(X+.5-cx)/unit,dz=(Z+.5-cz)/unit,u=dx*c+dz*sn,v=-dx*sn+dz*c,t=Math.max(0,Math.min(1,(v+.44)/.88)),curve=(j-.5)*t*t*.23,w=.095+(.012-.095)*t;
    const blade=1-smoothRange(-aa,aa,Math.max(Math.abs(u+curve)-w,Math.abs(v)-.44));if(blade<=0)continue;
    const k=(Z&mask)*N+(X&mask),edge=Math.max(-1,Math.min(1,(u+curve)/Math.max(.03,w)))*blade*.34,along=(t-.35)*blade*.08;
    cover[k]=Math.max(cover[k],blade);tip[k]+=blade*(.3+.7*t)*(.65+j*.35);
    gx[k]+=c*edge-sn*along;gz[k]+=sn*edge+c*along;
   }
   if((z*cells+x)%4===3)yield {label:'Preparando a textura do gramado'};
  }
 }
 const bytes=new Uint8Array(pixels*4);
 for(let i=0;i<pixels;i++){const k=i*4;bytes[k]=Math.round(cover[i]*255);bytes[k+1]=Math.round(Math.min(1,tip[i])*255);bytes[k+2]=Math.round(Math.max(0,Math.min(1,gx[i]/1.4+.5))*255);bytes[k+3]=Math.round(Math.max(0,Math.min(1,gz[i]/1.4+.5))*255);if(i%2048===2047)yield {label:'Preparando a textura do gramado'}}
 const texture=gl.createTexture();gl.activeTexture(gl.TEXTURE4);gl.bindTexture(gl.TEXTURE_2D,texture);
 gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,N,N,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.REPEAT);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.REPEAT);gl.generateMipmap(gl.TEXTURE_2D);
 const extension=gl.getExtension('EXT_texture_filter_anisotropic')||gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
 const anisotropy=extension?Math.min(4,gl.getParameter(extension.MAX_TEXTURE_MAX_ANISOTROPY_EXT)):1;
 if(extension)gl.texParameterf(gl.TEXTURE_2D,extension.TEXTURE_MAX_ANISOTROPY_EXT,anisotropy);
 gl.activeTexture(gl.TEXTURE0);return {texture,anisotropy};
}
function makeShadowTarget(size){
 const fbo=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);
 const texture=colorTexture(size,size,gl.NEAREST);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,texture,0);
 const depth=gl.createRenderbuffer();gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,size,size);
 gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);
 const valid=gl.checkFramebufferStatus(gl.FRAMEBUFFER)===gl.FRAMEBUFFER_COMPLETE;gl.bindFramebuffer(gl.FRAMEBUFFER,null);
 gl.bindTexture(gl.TEXTURE_2D,null);return {size,fbo,texture,depth,valid};
}
