precision highp float;
varying vec2 v_uv;
uniform sampler2D u_color;
uniform vec2 u_inputViewport;
uniform vec2 u_resourceSize;
vec3 loadPixel(vec2 p){return texture2D(u_color,(clamp(p,vec2(0.),u_inputViewport-1.)+.5)/u_resourceSize).rgb;}
float luma2(vec3 c){return c.g+.5*(c.r+c.b);}
void easuSet(inout vec2 dir,inout float len,float w,float A,float B,float C,float D,float E){
 float dx=D-B,dy=E-A;
 dir+=vec2(dx,dy)*w;
 vec2 reversal=clamp(abs(vec2(dx,dy))/max(vec2(max(abs(D-C),abs(C-B)),max(abs(E-C),abs(C-A))),vec2(.000001)),0.,1.);
 len+=dot(reversal,reversal)*w;
}
void easuTap(inout vec3 sum,inout float weight,vec2 off,vec2 dir,vec2 stretch,float lobe,float clipping,vec3 color){
 vec2 v=vec2(dot(off,dir),dot(off,vec2(-dir.y,dir.x)))*stretch;
 float d2=min(dot(v,v),clipping),base=.4*d2-1.,window=lobe*d2-1.;
 float w=(1.5625*base*base-.5625)*window*window;
 sum+=color*w;weight+=w;
}
void main(){
 vec2 p=v_uv*u_inputViewport-.5,base=floor(p),f=fract(p);
 vec3 b=loadPixel(base+vec2(0.,-1.)),c=loadPixel(base+vec2(1.,-1.));
 vec3 e=loadPixel(base+vec2(-1.,0.)),F=loadPixel(base),g=loadPixel(base+vec2(1.,0.)),h=loadPixel(base+vec2(2.,0.));
 vec3 i=loadPixel(base+vec2(-1.,1.)),j=loadPixel(base+vec2(0.,1.)),k=loadPixel(base+vec2(1.,1.)),l=loadPixel(base+vec2(2.,1.));
 vec3 n=loadPixel(base+vec2(0.,2.)),o=loadPixel(base+vec2(1.,2.));
 vec2 dir=vec2(0.);float len=0.;
 easuSet(dir,len,(1.-f.x)*(1.-f.y),luma2(b),luma2(e),luma2(F),luma2(g),luma2(j));
 easuSet(dir,len,f.x*(1.-f.y),luma2(c),luma2(F),luma2(g),luma2(h),luma2(k));
 easuSet(dir,len,(1.-f.x)*f.y,luma2(F),luma2(i),luma2(j),luma2(k),luma2(n));
 easuSet(dir,len,f.x*f.y,luma2(g),luma2(j),luma2(k),luma2(l),luma2(o));
 float norm=dot(dir,dir);dir=norm<1./32768.?vec2(1.,0.):dir*inversesqrt(norm);
 len=pow(len*.5,2.);
 float stretch=dot(dir,dir)/max(max(abs(dir.x),abs(dir.y)),.000001);
 vec2 axis=vec2(1.+(stretch-1.)*len,1.-.5*len);
 float lobe=.5+(.21-.5)*len,clipping=1./lobe,weight=0.;vec3 sum=vec3(0.);
 easuTap(sum,weight,vec2(0.,-1.)-f,dir,axis,lobe,clipping,b);easuTap(sum,weight,vec2(1.,-1.)-f,dir,axis,lobe,clipping,c);
 easuTap(sum,weight,vec2(-1.,1.)-f,dir,axis,lobe,clipping,i);easuTap(sum,weight,vec2(0.,1.)-f,dir,axis,lobe,clipping,j);
 easuTap(sum,weight,vec2(0.,0.)-f,dir,axis,lobe,clipping,F);easuTap(sum,weight,vec2(-1.,0.)-f,dir,axis,lobe,clipping,e);
 easuTap(sum,weight,vec2(1.,1.)-f,dir,axis,lobe,clipping,k);easuTap(sum,weight,vec2(2.,1.)-f,dir,axis,lobe,clipping,l);
 easuTap(sum,weight,vec2(2.,0.)-f,dir,axis,lobe,clipping,h);easuTap(sum,weight,vec2(1.,0.)-f,dir,axis,lobe,clipping,g);
 easuTap(sum,weight,vec2(1.,2.)-f,dir,axis,lobe,clipping,o);easuTap(sum,weight,vec2(0.,2.)-f,dir,axis,lobe,clipping,n);
 vec3 lo=min(min(F,g),min(j,k)),hi=max(max(F,g),max(j,k));
 gl_FragColor=vec4(clamp(sum/max(weight,.000001),lo,hi),1.);
}
