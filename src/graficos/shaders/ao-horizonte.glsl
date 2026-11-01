precision highp float;
varying vec2 v_uv;
${FOG_GLSL}
${AO_SURFACE_GLSL}
// Cosine-weighted horizon integration (GTAO, Jimenez et al. 2016).
// Finite range and thin-occluder compensation follow the concerns documented
// by Intel XeGTAO (MIT reference retained in the bundled licenses), adapted
// to classic WebGL without compute shaders, depth mipmaps or temporal noise.
float horizonSample(vec2 uv,vec3 p,vec3 n,vec3 view,float openHorizon,float bias){
 if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))return openHorizon;
 uv=aoSnap(uv);float raw=sampleDepth(uv);
 if(raw>.99999)return openHorizon;
 vec3 delta=aoPosition(uv,viewDepth(raw))-p;
 float distance=length(delta);
 if(distance<.0001||dot(n,delta)<=bias)return openHorizon;
 float range=1.-smoothstep(u_aoRadius*.30,u_aoRadius,distance);
 // Leaves and silhouettes must not act as infinitely deep opaque walls.
 float thickness=1.-smoothstep(u_aoRadius*.20,u_aoRadius*.80,abs(delta.z));
 return mix(openHorizon,dot(delta,view)/distance,range*thickness);
}
float visibleArc(float lower,float upper,float angle){
 float c=cos(angle),s=sin(angle);
 return (2.*c+2.*(lower+upper)*s-cos(2.*lower-angle)-cos(2.*upper-angle))*.25;
}
void main(){
 vec2 center=v_uv,uv=center-vec2(.25)/u_aoViewport;
 float raw=sampleDepth(uv),code=0.;
 for(int i=1;i<4;i++){
  float fi=float(i);vec2 candidate=center+(vec2(mod(fi,2.),floor(fi*.5))-.5)*.5/u_aoViewport;
  float d=sampleDepth(candidate);if(d<raw){raw=d;uv=candidate;code=fi;}
 }
 if(raw>.99999){gl_FragColor=vec4(1.,packAODepth(4000.),code/3.);return;}
 uv=aoSnap(uv);vec3 p=aoPosition(uv,viewDepth(raw));
 if(fogAmount(p)>=1.){gl_FragColor=vec4(1.,packAODepth(-p.z),code/3.);return;}
 // Integrate around the actual depth plane. Smooth lighting normals on a
 // faceted crown would otherwise invent concavity on an exposed convex face.
 vec3 n=aoDepthNormal(uv,p),view=normalize(-p);
 if(dot(n,n)<.5){gl_FragColor=vec4(1.,packAODepth(-p.z),code/3.);return;}
 vec2 radiusUV=vec2(u_aoRadius)/(2.*u_projection*max(2.,-p.z));
 float footprint=min(radiusUV.x*u_resolution.x,radiusUV.y*u_resolution.y);
 float resolved=smoothstep(.8,3.,footprint);
 if(resolved<=0.){gl_FragColor=vec4(1.,packAODepth(-p.z),code/3.);return;}
 float slices=max(1.,u_aoSlices),steps=max(1.,u_aoSteps*.5),openIntegral=0.,visibleIntegral=0.;
 float bias=max(.12,-p.z*.00008)+u_aoRadius*.012;
 float rotation=fract(dot(mod(floor(gl_FragCoord.xy),4.),vec2(.25,.5625)))*AO_PI;
 for(int slice=0;slice<4;slice++){
  if(float(slice)>=slices)break;
  float phi=(float(slice)+.5)*AO_PI/slices+rotation;
  vec2 direction=vec2(cos(phi),sin(phi));
  vec3 screenDirection=vec3(direction*u_projection,0.);
  vec3 tangent=normalize(screenDirection-view*dot(screenDirection,view));
  vec3 axis=normalize(cross(tangent,view)),projected=n-axis*dot(n,axis);
  float weight=length(projected);
  if(weight<.001)continue;
  float angle=atan(dot(projected,tangent),max(.00001,dot(projected,view)));
  float lowerOpen=angle-AO_PI*.5,upperOpen=angle+AO_PI*.5;
  float positive=cos(upperOpen),negative=cos(lowerOpen);
  for(int step=0;step<3;step++){
   if(float(step)>=steps)break;
   float t=(float(step)+.5)/steps;
   vec2 offset=direction*radiusUV*(.06+.94*t*t);
   positive=max(positive,horizonSample(uv+offset,p,n,view,cos(upperOpen),bias));
   negative=max(negative,horizonSample(uv-offset,p,n,view,cos(lowerOpen),bias));
  }
  float lower=max(lowerOpen,-acos(clamp(negative,-1.,1.)));
  float upper=min(upperOpen,acos(clamp(positive,-1.,1.)));
  float available=max(.00001,visibleArc(lowerOpen,upperOpen,angle));
  openIntegral+=available*weight;
  visibleIntegral+=clamp(visibleArc(lower,upper,angle),0.,available)*weight;
 }
 float visibility=clamp(visibleIntegral/max(.0001,openIntegral),0.,1.);
 float obscured=min(.42,(1.-visibility)*u_aoStrength)*resolved;
 gl_FragColor=vec4(1.-obscured,packAODepth(-p.z),code/3.);
}
