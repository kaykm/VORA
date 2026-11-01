// Shared surface reconstruction for GTAO, denoising and final composition.
// Historical references: Jimenez et al. 2016 and Intel XeGTAO; no SDK is required.
uniform highp sampler2D u_sceneDepth;
uniform highp sampler2D u_surface;
uniform vec2 u_resolution;
uniform vec2 u_projection;
uniform vec2 u_projectionJitter;
uniform vec2 u_activeScale;
uniform vec2 u_aoViewport;
uniform vec2 u_aoResource;
uniform mat3 u_viewRotation;
uniform float u_hasSurface;
uniform float u_aoRadius;
uniform float u_aoStrength;
uniform float u_aoSlices;
uniform float u_aoSteps;
uniform float u_aoEnabled;
const float AO_PI=3.14159265359;
vec2 sceneUV(vec2 uv){return clamp(uv,.5/u_resolution,1.-.5/u_resolution)*u_activeScale;}
vec2 aoSnap(vec2 uv){return (floor(clamp(uv,vec2(0.),1.-.5/u_resolution)*u_resolution)+.5)/u_resolution;}
float sampleDepth(vec2 uv){return texture2D(u_sceneDepth,sceneUV(uv)).r;}
float viewDepth(float d){return 16000./(4002.-(d*2.-1.)*3998.);}
vec3 aoPosition(vec2 uv,float z){return vec3(((uv-u_projectionJitter)*2.-1.)*u_projection*z,-z);}
vec3 viewPosition(vec2 uv){uv=aoSnap(uv);return aoPosition(uv,viewDepth(sampleDepth(uv)));}
vec3 decodeNormal(vec2 f){
 f=f*2.-1.;vec3 n=vec3(f,1.-abs(f.x)-abs(f.y));float t=clamp(-n.z,0.,1.);
 n.xy+=vec2(n.x>=0.?-t:t,n.y>=0.?-t:t);return normalize(n);
}
vec3 aoDepthNormal(vec2 uv,vec3 p){
 vec2 px=1./u_resolution;
 vec3 dl=p-viewPosition(uv-vec2(px.x,0.)),dr=viewPosition(uv+vec2(px.x,0.))-p;
 vec3 db=p-viewPosition(uv-vec2(0.,px.y)),dt=viewPosition(uv+vec2(0.,px.y))-p;
 // At a viewport edge one neighbor clamps to the center pixel. Prefer the
 // nonzero inward difference instead of manufacturing a zero surface normal.
 vec3 dx=(dot(dr,dr)<1.e-12||abs(dl.z)<abs(dr.z))&&dot(dl,dl)>1.e-12?dl:dr;
 vec3 dy=(dot(dt,dt)<1.e-12||abs(db.z)<abs(dt.z))&&dot(db,db)>1.e-12?db:dt;
 vec3 c=cross(dx,dy),n=c*inversesqrt(max(dot(c,c),1.e-12));return dot(n,-p)<0.?-n:n;
}
vec3 aoNormal(vec2 uv,vec3 p){
 if(u_hasSurface>.5){vec3 n=normalize(u_viewRotation*decodeNormal(texture2D(u_surface,sceneUV(uv)).rg));return dot(n,-p)<0.?-n:n;}
 return aoDepthNormal(uv,p);
}
vec2 packAODepth(float z){float v=floor(clamp(z/4000.,0.,1.)*65535.+.5);return vec2(floor(v/256.),mod(v,256.))/255.;}
float unpackAODepth(vec4 value){return (value.g*65280.+value.b*255.)*(4000./65535.);}
vec2 aoAnchor(vec2 center,vec4 value){float code=floor(value.a*3.+.5);return aoSnap(center+(vec2(mod(code,2.),floor(code*.5))-.5)*.5/u_aoViewport);}
vec4 aoLoad(highp sampler2D tex,vec2 uv){return texture2D(tex,clamp(uv,.5/u_aoViewport,1.-.5/u_aoViewport)*u_aoViewport/u_aoResource);}
float aoSurfaceWeight(vec3 p,vec3 n,vec2 uv,vec4 value){
 float z=unpackAODepth(value);
 if(z>3995.)return 0.;
 vec2 anchor=aoAnchor(uv,value);
 vec3 delta=aoPosition(anchor,z)-p,neighbor=n;
 float normalWeight=1.;
 if(u_hasSurface>.5){
  neighbor=normalize(u_viewRotation*decodeNormal(texture2D(u_surface,sceneUV(anchor)).rg));
  if(dot(neighbor,-aoPosition(anchor,z))<0.)neighbor=-neighbor;
  normalWeight=smoothstep(.25,.8,dot(n,neighbor));
 }
 float plane=max(abs(dot(n,delta)),abs(dot(neighbor,delta)));
 float pixel=2.*max(-p.z,z)*u_projection.y/u_resolution.y;
 float tolerance=max(.22,u_aoRadius*.045)+min(pixel*.20,u_aoRadius*.08);
 float planeWeight=exp2(-plane*plane/(tolerance*tolerance));
 // The two tangent planes must agree; a nearby but separate silhouette cannot bleed.
 float depthWeight=1.-smoothstep(u_aoRadius*.25,u_aoRadius*.75,abs(delta.z));
 return normalWeight*planeWeight*depthWeight;
}
