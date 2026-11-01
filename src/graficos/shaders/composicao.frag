
 #ifdef GL_OES_standard_derivatives
 #extension GL_OES_standard_derivatives : enable
 #endif
 precision highp float;varying vec2 v_uv;
 uniform sampler2D u_color;uniform float u_aaKind;
${FOG_GLSL}
${AO_SURFACE_GLSL}

vec3 sampleColor(vec2 uv){return texture2D(u_color,sceneUV(uv)).rgb;}
float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
vec3 antialias(vec2 uv){
 vec2 px=1./u_resolution;vec3 center=sampleColor(uv);if(u_aaKind<.5)return center;float M=luma(center);
 float N=luma(sampleColor(uv+vec2(0.,px.y))),S=luma(sampleColor(uv-vec2(0.,px.y))),E=luma(sampleColor(uv+vec2(px.x,0.))),W=luma(sampleColor(uv-vec2(px.x,0.)));
 float lo=min(M,min(min(N,S),min(E,W))),hi=max(M,max(max(N,S),max(E,W))),range=hi-lo;
 float contrastThreshold=u_aaKind<1.5?.166:u_aaKind>2.5?.0833:.125;
 if(range<max(u_aaKind>2.5?.0208:.0312,hi*contrastThreshold))return center;
 float NW=luma(sampleColor(uv+vec2(-px.x,px.y))),NE=luma(sampleColor(uv+px)),SW=luma(sampleColor(uv-px)),SE=luma(sampleColor(uv+vec2(px.x,-px.y)));
 float horizontal=abs(N+S-2.*M)*2.+abs(NE+SE-2.*E)+abs(NW+SW-2.*W);
 float vertical=abs(E+W-2.*M)*2.+abs(NE+NW-2.*N)+abs(SE+SW-2.*S);
 bool isHorizontal=horizontal>=vertical;
 float first=isHorizontal?N:W,second=isHorizontal?S:E,g1=first-M,g2=second-M;
 bool steep=abs(g1)>=abs(g2);float stepSize=isHorizontal?px.y:px.x;
 if(steep)stepSize=-stepSize;
 float average=.5*(M+(steep?first:second)),threshold=.25*max(abs(g1),abs(g2));
 vec2 perpendicular=isHorizontal?vec2(0.,-stepSize):vec2(stepSize,0.);
 // The perpendicular points toward the steepest side of this edge.
 vec2 origin=uv+perpendicular*.5,along=isHorizontal?vec2(px.x,0.):vec2(0.,px.y);
 vec2 left=origin-along,right=origin+along;
 float leftL=luma(sampleColor(left))-average,rightL=luma(sampleColor(right))-average;
 bool leftDone=abs(leftL)>=threshold,rightDone=abs(rightL)>=threshold;
 for(int i=0;i<8;i++){
  if(leftDone&&rightDone||u_aaKind<1.5&&i>=2||u_aaKind<2.5&&i>=5)break;
  float distance=i<2?1.5:i<4?2.:4.;
  if(!leftDone){left-=along*distance;leftL=luma(sampleColor(left))-average;leftDone=abs(leftL)>=threshold;}
  if(!rightDone){right+=along*distance;rightL=luma(sampleColor(right))-average;rightDone=abs(rightL)>=threshold;}
 }
 float d1=isHorizontal?uv.x-left.x:uv.y-left.y,d2=isHorizontal?right.x-uv.x:right.y-uv.y;
 float edgeOffset=.5-min(d1,d2)/max(d1+d2,.000001),endL=d1<d2?leftL:rightL;
 if((endL<0.)==((M-average)<0.))edgeOffset=0.;
 float sub=clamp(abs((2.*(N+S+E+W)+NW+NE+SW+SE)/12.-M)/max(range,.000001),0.,1.);
 sub=sub*sub*(3.-2.*sub);sub=sub*sub*(u_aaKind<1.5?.3:u_aaKind>2.5?.75:.55);
 return sampleColor(uv+perpendicular*max(edgeOffset,sub));
}
uniform highp sampler2D u_ao;
float filteredAO(vec2 uv,vec3 p,vec3 n){
 vec2 grid=uv*u_aoViewport-.5,base=floor(grid),f=fract(grid);float sum=0.,weights=0.;
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){
  vec2 corner=vec2(float(x),float(y)),sampleUV=(base+corner+.5)/u_aoViewport;
  vec4 value=aoLoad(u_ao,sampleUV);vec2 blend=mix(1.-f,f,corner);
  float w=blend.x*blend.y*aoSurfaceWeight(p,n,sampleUV,value);
  sum+=value.r*w;weights+=w;
 }
 // Sparse valid support occurs at silhouettes: fade to open space, never a dark rim.
 float confidence=smoothstep(.05,.45,weights);
 return mix(1.,clamp(sum/max(weights,.0001),.58,1.),confidence);
}
void main(){
 vec3 color = antialias(v_uv);
 // FXAA without AO does not need any depth or normal texture reads.
 if (u_aoEnabled > .5) {
  vec2 uv = aoSnap(v_uv);
  float raw = sampleDepth(uv);
  if (raw < .99999) {
   vec3 p = aoPosition(uv, viewDepth(raw));
   float fog = fogAmount(p);
   if (fog < 1.) {
    vec3 n = aoNormal(uv, p);
    float visibility = filteredAO(uv, p, n);
    float ambient = u_hasSurface > .5 ? texture2D(u_surface, sceneUV(uv)).b : .58;
    color = occludeFoggedSurface(color, fog, visibility, ambient);
   }
  }
 }
 gl_FragColor=vec4(color,1.);
}
