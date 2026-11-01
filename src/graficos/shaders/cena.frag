
#ifdef GL_OES_standard_derivatives
#extension GL_OES_standard_derivatives : enable
#endif
precision highp float;varying vec3 v_world;varying vec3 v_normal;varying vec3 v_color;varying vec3 v_local;
uniform vec3 u_tint;uniform vec3 u_hole;uniform vec3 u_apertureSin;uniform vec3 u_apertureCos;uniform float u_material;uniform float u_depth;uniform float u_travel;uniform vec3 u_eye;uniform float u_pixelScale;uniform float u_reactive;
// Packed depth needs high-precision texture reads; lowp quantization creates false shadows on curves.
uniform highp sampler2D u_shadowMap;uniform highp sampler2D u_staticShadowMap;uniform sampler2D u_turfMap;uniform mat4 u_lightViewProjection;
uniform float u_renderPass;uniform float u_shadowEnabled;uniform float u_shadowTexel;uniform float u_staticShadowTexel;uniform float u_shadowWorldTexel;uniform float u_staticShadowWorldTexel;uniform vec4 u_liveShadowWindow;
// Quality selects 4/9/16 depth comparisons; softness is a stable 0..1 texel radius blend.
uniform float u_shadowQuality;uniform float u_shadowSoftness;
uniform float u_shadowDistance;uniform vec2 u_shadowCenter;uniform float u_shadowDepthRange;
uniform highp sampler2D u_shadowBoundsMap;uniform float u_shadowBoundsEnabled;
varying vec4 v_shadow;
${FOG_GLSL}
const vec3 SUN=normalize(vec3(-.62,.78,.28));
float materialFootprint=.6,materialWalk=-100000.,gGrass=0.,gMicroAO=1.;
float gLocalFootprint=.6,gMaterialHeight=0.;vec3 gSurfaceNormal=vec3(0.,1.,0.);
vec2 gTurfGradient=vec2(0.),gShadowGradient=vec2(0.);
vec4 packShadow(float depth){vec3 enc=fract(depth*vec3(1.,255.,65025.));enc.xy-=enc.yz/255.;return vec4(enc,1.);}
float unpackShadow(vec3 value){return dot(value,vec3(1.,1./255.,1./65025.));}
float shadowDepthRange(){return max(2200.,u_shadowDepthRange);}
float apertureRadiusAt(vec2 p);
// Move the receiver a fraction of a shadow texel along its light-facing normal.
// The world-space cap keeps curved foliage clean without detaching ground contacts.
vec3 shadowReceiver(vec3 q,vec3 n,float cell,float foliage){
 float facing=dot(n,SUN),grazing=1.-abs(facing);
 vec3 normal=facing<0.?-n:n;
 float offset=min(.85,cell*(.10+grazing*.20+foliage*.10));
 return q+(u_lightViewProjection*vec4(normal*offset,0.)).xyz*.5;
}
float shadowTap(highp sampler2D map,vec3 q,vec2 tap,float cell,vec2 gradient,float bias,float staticLayer){
 if(tap.x<0.||tap.y<0.||tap.x>1.||tap.y>1.)return 1.;
 vec4 stored=texture2D(map,tap);float z=unpackShadow(stored.rgb);
 // The lining already receives continuous opening visibility. Cargo/props still cast on it.
 if(staticLayer<.5&&stored.a<.4&&u_material>=2.&&u_material<=4.)z=1.;
 // Static low plants disappear through the live excavation without rebuilding the forest.
 if(staticLayer>.5&&stored.a<.75){
  vec2 caster=v_world.xz+SUN.xz*(q.z-z)*shadowDepthRange()-u_hole.xy;
  float d=length(caster),r=u_hole.z;
  if(d<r*1.09+2.)r=apertureRadiusAt(caster);
  if(d<r)z=1.;
 }
 // Near a silhouette the derivative plane can become almost singular. Never let
 // that extrapolation turn adjacent canopy lobes into long black wedges.
 float plane=dot(gradient,tap-q.xy),limit=cell*1.5/shadowDepthRange();
 float confidence=1.-smoothstep(limit,limit*2.5,abs(plane));
 plane=clamp(plane,-limit,limit);
 float receiver=q.z+plane-bias;
 float transition=(.035+min(.08,cell*.025))/shadowDepthRange();
 // An unreliable grazing-plane tap must fade out, not become a dark seam.
 float visibility=smoothstep(receiver-transition,receiver+transition,z);
 // Low leaves transmit scattered sunlight. Their contact shadow remains clear
 // without turning a dense carpet into a sheet of black cutout silhouettes.
 float opacity=staticLayer>.5&&stored.a>.42&&stored.a<.57?.55:1.;
 return mix(1.,visibility,confidence*opacity);
}
${SHADOW_BOUNDS_GLSL}
float shadowFilter(highp sampler2D map,vec3 q,float texel,float cell,vec2 gradient,float staticLayer,float facing,float foliage){
 vec2 pixel=q.xy/texel-.5,base=floor(pixel);
 float count=2.,radius=1.;
 if(u_shadowQuality>.5){
  count=3.;base=floor(pixel+.5)-1.;
  radius=1.+clamp(u_shadowSoftness,0.,1.)*.5;
 }
 if(u_shadowQuality>1.5){
  count=4.;base=floor(pixel)-1.;
  radius=1.+clamp(u_shadowSoftness,0.,1.);
 }
 float bias=(.055+min(.72,cell*(.055+(1.-facing)*.10+foliage*.09)))/shadowDepthRange();
 if(staticLayer>.5&&u_shadowBoundsEnabled>.5&&u_shadowQuality>1.5){
  float bounded=boundedShadowVisibility(q,base,texel,cell,gradient,bias);
  if(bounded>=0.)return bounded;
 }
 float visibility=0.,total=0.;
 // Fixed map-space taps and continuous weights do not crawl or rotate with the camera.
 for(int y=0;y<4;y++)for(int x=0;x<4;x++){
  if(float(x)>=count||float(y)>=count)continue;
  vec2 samplePixel=base+vec2(float(x),float(y));
  vec2 weight=max(vec2(0.),vec2(1.)-abs(samplePixel-pixel)/radius);
  if(u_shadowQuality>.5)weight=weight*weight*(3.-2.*weight);
  float w=weight.x*weight.y;
  if(w<=0.)continue;
  vec2 tap=(samplePixel+.5)*texel;
  visibility+=shadowTap(map,q,tap,cell,gradient,bias,staticLayer)*w;total+=w;
 }
 return visibility/max(total,.0001);
}
float sunVisibility(vec3 n){
 if(u_shadowEnabled<.5)return 1.;
 // Outside the fade, no shadow tap can contribute to the final pixel.
 if(u_shadowDistance>0.&&distance(v_world.xz,u_shadowCenter)>=u_shadowDistance)return 1.;
 vec3 q=v_shadow.xyz/v_shadow.w*.5+.5;
 if(q.x<.003||q.x>.997||q.y<.003||q.y>.997||q.z<0.||q.z>1.)return 1.;
 float foliage=((u_material==14.||u_material==15.)&&floor(v_color.b*.5+.001)==3.)?1.:0.;
 float facing=abs(dot(n,SUN));
 vec3 fixedReceiver=shadowReceiver(q,n,u_staticShadowWorldTexel,foliage);
 float staticVisibility=shadowFilter(u_staticShadowMap,fixedReceiver,u_staticShadowTexel,u_staticShadowWorldTexel,gShadowGradient,1.,facing,foliage);
 vec3 liveReceiver=shadowReceiver(q,n,u_shadowWorldTexel,foliage);
 vec3 live=vec3((liveReceiver.xy-u_liveShadowWindow.xy)/u_liveShadowWindow.zw,liveReceiver.z);
 float visibility=staticVisibility;
 if(visibility>0.&&live.x>=.001&&live.x<=.999&&live.y>=.001&&live.y<=.999)
  visibility=min(visibility,shadowFilter(u_shadowMap,live,u_shadowTexel,u_shadowWorldTexel,gShadowGradient*u_liveShadowWindow.zw,0.,facing,foliage));
 // Distance changes coverage, not map resolution. A soft outer band avoids
 // showing the rectangular boundary of the shadow atlas on the ground.
 if(u_shadowDistance>0.)visibility=mix(1.,visibility,1.-smoothstep(u_shadowDistance*.82,u_shadowDistance,distance(v_world.xz,u_shadowCenter)));
 return visibility;
}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 a=floor(p),b=fract(p);b=b*b*b*(b*(b*6.-15.)+10.);return mix(mix(hash(a),hash(a+vec2(1.,0.)),b.x),mix(hash(a+vec2(0.,1.)),hash(a+vec2(1.,1.)),b.x),b.y);}
${TERRAIN_FIELD_GLSL}
float biome(vec2 p){if(walkField(p)>0.)return 1.;vec2 r=regionFields(p);if(r.x>0.)return 2.;if(r.y>0.)return 3.;return 0.;}
// The same periodic opening as the mesh, without per-pixel atan/sin calls.
// Phase sine/cosine values are shared by the whole frame.
float apertureRadiusAt(vec2 p){
 vec2 a=p/max(length(p),.00001);float c=a.x,s=a.y,c2=c*c-s*s,s2=2.*c*s;
 vec3 sn=vec3(s2,s2*c+c2*s,2.*s2*c2),cs=vec3(c2,c2*c-s2*s,c2*c2-s2*s2);
 return u_hole.z*(1.+dot(vec3(.040,.026,.012),sn*u_apertureCos+cs*u_apertureSin));
}
float granularBiome(vec3 p){float d=max(0.,-p.y);float broad=noise(p.xz*.035),detail=noise(p.xz*.075),edge=(noise(p.xz*.14)-.5)*5.+(detail-.5)*1.0;float stone=materialWalk;vec2 regions=regionFields(p.xz);float dirt=regions.x;float sand=regions.y;float surface=0.;if(dirt+edge>0.)surface=2.;if(sand+edge>0.)surface=3.;if(stone+edge>0.)surface=1.;float boundary=2.4+(broad-.5)*.4+(detail-.5)*.2;if(surface==1.&&d<boundary)return 1.;float topsoil=surface==1.?20.:surface==3.?36.:19.;float clay=surface==3.?78.:60.;float rock=108.+(broad-.5)*23.+(noise(p.xz*.08)-.5)*9.;float relief=(broad-.5)*9.+(detail-.5)*1.2;if(d<topsoil+relief)return surface==3.?3.:0.;if(d<clay+relief)return 2.;if(d<rock){float inclusions=noise(p.xz*.055+vec2(17.3,-8.1));return inclusions>.70-(d-clay)/max(1.,rock-clay)*.4?1.:2.;}return 1.;}
float stationDistance(vec2 p){vec2 q=abs(p-vec2(${base.x.toFixed(1)},${base.y.toFixed(1)}));return max(max(q.x-${STATION.halfX.toFixed(1)},q.y-${STATION.halfZ.toFixed(1)}),(q.x+q.y-${(STATION.halfX+STATION.halfZ-STATION.chamfer).toFixed(1)})/1.41421356);}
// Shared by color and shadow passes; matches the CPU walkway visibility rule.
bool stationCoversWalkway(vec3 p){
 return stationDistance(p.xz)<-.1&&p.y<=${STATION.deck.toFixed(3)}+.1;
}
float stationWeight(vec3 p){return (1.-smoothstep(-.7,.7,stationDistance(p.xz)))*smoothstep(-${(STATION.depth+1).toFixed(1)},-${(STATION.depth-1).toFixed(1)},p.y);}
vec3 stationSurface(vec2 p){float n=noise(p*.055),g=noise(p*.17);return vec3(.55,.545,.475)*(.94+n*.09+(g-.5)*.035);}
vec3 chipColor(vec3 p){float b=granularBiome(p),q=hash(floor(p.xz*3.+p.y));vec3 c=b<.5?vec3(.40,.31,.18):b<1.5?vec3(.59,.60,.54):b<2.5?vec3(.52,.32,.17):vec3(.77,.65,.42);return c*(.83+q*.30);}
vec3 stoneCell(vec2 uv){vec2 cell=floor(uv),f=fract(uv);float first=99.,second=99.,seed=0.;for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 o=vec2(float(x),float(y)),id=cell+o;vec2 point=vec2(hash(id),hash(id+vec2(19.7,37.2)))*.72+.14;vec2 d=o+point-f;float q=dot(d,d);if(q<first){second=first;first=q;seed=hash(id+vec2(8.2,4.7));}else if(q<second)second=q;}return vec3(sqrt(first),sqrt(second)-sqrt(first),seed);}
// Broad material forms first; subpixel detail fades continuously instead of sparkling.
// World projections and lighting normals are intentionally independent.
float detailVisibility(float frequency){return 1.-smoothstep(.22,.80,materialFootprint*frequency);}
float filteredNoise(vec2 uv,float frequency){return .5+(noise(uv*frequency)-.5)*detailVisibility(frequency);}
vec3 planarInterior(vec2 uv,float kind,float depthBelow,bool floorMode){
 vec2 rotated=vec2(uv.x*.80-uv.y*.60,uv.x*.60+uv.y*.80);
 float macro=filteredNoise(uv+vec2(23.,-11.),.037),grain=filteredNoise(rotated,.38);
 float aggregate=filteredNoise(uv+vec2(17.,6.),.13)*.64+filteredNoise(rotated+vec2(-8.,12.),.25)*.36;
 float shape=smoothstep(.08,.92,aggregate),pore=smoothstep(.71,.88,grain)*detailVisibility(.38);vec3 c;
 if(kind<.5){
  c=mix(vec3(.285,.197,.122),vec3(.49,.355,.225),macro*.40+shape*.60);
  c*=1.-pore*.11;c+=vec3(.115,.080,.048)*(grain-.5);
 }else if(kind<1.5){
  // A thin, pale cut concrete slab, with embedded aggregate rather than a cobble pattern.
  float stone=smoothstep(.58,.75,aggregate)*detailVisibility(.145);
  c=mix(vec3(.50,.505,.445),vec3(.70,.685,.575),macro);
  c=mix(c,vec3(.39,.405,.355),stone*.28);c*=1.-pore*.12;c+=(grain-.5)*.035;
 }else if(kind<2.5){
  float sediment=filteredNoise(vec2(uv.x*.42,uv.y),.105);
  c=mix(vec3(.45,.271,.155),vec3(.67,.435,.265),shape*.55+macro*.45);
  c*=.955+sediment*.09;c*=1.-pore*.08;c+=vec3(.11,.072,.044)*(grain-.5);
 }else if(kind<3.5){
  float drift=filteredNoise(vec2(uv.x*.35,uv.y),.10);
  c=mix(vec3(.66,.535,.345),vec3(.84,.715,.505),macro*.5+aggregate*.5);
  c*=.96+drift*.08;c+=(grain-.5)*.025;
 }else if(kind<4.5){
  float mineral=smoothstep(.59,.78,aggregate)*detailVisibility(.145);
  c=mix(vec3(.405,.330,.235),vec3(.62,.515,.365),macro);
  c=mix(c,vec3(.64,.60,.47),mineral*.24);c*=1.-pore*.10;c+=(grain-.5)*.06;
 }else{
  // Large weathered strata: interrupted seams, not a repeated polygon mosaic.
  vec2 q=uv*vec2(.045,.072)+vec2(0.,(macro-.5)*.30);
  vec3 cell=stoneCell(q);float aa=max(.016,materialFootprint*.055);
  float seam=(1.-smoothstep(.022,.055+aa,cell.y))*smoothstep(.42,.70,macro)*detailVisibility(.10);
  float facet=smoothstep(.05,.68,cell.x);
  c=mix(vec3(.355,.375,.330),vec3(.57,.555,.455),macro*.65+aggregate*.35);
  c*=.94+aggregate*.11;c+=vec3(.035,.028,.018)*facet;
  c*=1.-seam*.18;c*=1.-pore*.065;c+=(grain-.5)*.035;
 }
 return c;
}
vec3 interiorAlbedo(vec3 p,vec3 n,float kind,bool floorMode){
 vec3 w=pow(abs(n),vec3(4.));w/=max(.0001,w.x+w.y+w.z);vec3 c=vec3(0.);
 if(w.x>.001)c+=planarInterior(vec2(p.z,-p.y),kind,-p.y,false)*w.x;
 if(w.y>.001)c+=planarInterior(p.xz,kind,-p.y,true)*w.y;
 if(w.z>.001)c+=planarInterior(vec2(p.x,-p.y),kind,-p.y,false)*w.z;
 return c;
}
// Analytic gradient of quintic noise: stable matte relief without another mesh layer.
vec2 noiseGradient(vec2 p){vec2 a=floor(p),t=fract(p),u=t*t*t*(t*(t*6.-15.)+10.),du=30.*t*t*(t*(t-2.)+1.);float A=hash(a),B=hash(a+vec2(1.,0.)),C=hash(a+vec2(0.,1.)),D=hash(a+vec2(1.,1.));return du*vec2(mix(B-A,D-C,u.y),mix(C-A,D-B,u.x));}
vec2 materialGradient(vec2 uv){
 vec2 rotated=vec2(uv.x*.80-uv.y*.60,uv.x*.60+uv.y*.80);
 vec2 a=noiseGradient((uv+vec2(17.,6.))*.13)*.13*.64*detailVisibility(.13);
 // One broad bump octave gives visible relief without evaluating several noise gradients per pixel.
 vec2 b=noiseGradient((rotated+vec2(-8.,12.))*.17)*.17*.36*detailVisibility(.17);
 vec2 broad=noiseGradient((uv+vec2(23.,-11.))*.037)*.037;
 return (a+vec2(.8*b.x+.6*b.y,-.6*b.x+.8*b.y))*1.9+broad*1.5;
}
vec3 reliefNormal(vec3 p,vec3 n){
 vec3 w=pow(abs(n),vec3(4.));w/=max(.0001,w.x+w.y+w.z);
 vec2 a=materialGradient(vec2(p.z,-p.y)),b=materialGradient(p.xz),c=materialGradient(vec2(p.x,-p.y));
 vec3 g=vec3(0.,-a.y,a.x)*w.x+vec3(b.x,0.,b.y)*w.y+vec3(c.x,-c.y,0.)*w.z;
 g-=n*dot(n,g);float strength=smoothstep(.7,6.,-p.y);
 return normalize(n-g*strength);
}
// One world-space material mask shared by the surface and the buried side wall.
vec4 surfaceWeights(vec2 p){float edge=(noise(p*.035)-.5)*2.2+(noise(p*.11)-.5)*.55;vec2 regions=regionFields(p);float dirt=smoothstep(-3.5,3.5,regions.x+edge),sand=smoothstep(-3.5,3.5,regions.y+edge),paving=smoothstep(-3.5,3.5,materialWalk+edge);vec4 w=vec4(1.-dirt,0.,dirt,0.);w=w*(1.-sand)+vec4(0.,0.,0.,sand);return w*(1.-paving)+vec4(0.,paving,0.,0.);}
// Horizons depend on depth and very slow world variation, never view angle or travel time.
vec3 layeredInterior(vec3 p,vec3 n,bool floorMode){
 float foundation=stationWeight(p);if(foundation>=1.)return interiorAlbedo(p,n,1.,floorMode)*.89;
 vec4 surface=surfaceWeights(p.xz);float d=max(0.,-p.y);
 float jitter=(noise(p.xz*.00875)-.5)*1.2+(noise(p.xz*.01875)-.5)*.45;
 vec4 top=smoothstep(vec4(16.5,1.8,16.5,33.5)+jitter,vec4(21.5,3.,21.5,38.5)+jitter,vec4(d));
 vec4 lower=smoothstep(vec4(55.,55.,55.,73.)+jitter,vec4(65.,65.,65.,83.)+jitter,vec4(d));
 float rock=smoothstep(100.+jitter*1.5,116.+jitter*1.5,d);
 vec4 topWeights=surface*(1.-top);float clay=dot(surface,top*(1.-lower));
 float substrate=dot(surface,top*lower)*(1.-rock),bedrock=dot(surface,top*lower)*rock;
 topWeights.z+=clay;vec3 color=vec3(0.);
 if(topWeights.x>.0001)color+=interiorAlbedo(p,n,0.,floorMode)*topWeights.x;
 if(topWeights.y>.0001)color+=interiorAlbedo(p,n,1.,floorMode)*topWeights.y;
 if(topWeights.z>.0001)color+=interiorAlbedo(p,n,2.,floorMode)*topWeights.z;
 if(topWeights.w>.0001)color+=interiorAlbedo(p,n,3.,floorMode)*topWeights.w;
 if(substrate>.0001)color+=interiorAlbedo(p,n,4.,floorMode)*substrate;
 if(bedrock>.0001)color+=interiorAlbedo(p,n,5.,floorMode)*bedrock;
 if(foundation>0.)color=mix(color,interiorAlbedo(p,n,1.,floorMode)*.89,foundation);return color;
}
// Visibility through the opening gives the whole cavity one coherent light field.
float cavityLight(vec3 p,vec3 n){
 float d=max(0.,-p.y),r=max(1.,u_hole.z);vec3 light=normalize(vec3(-.62,.78,.28));
 vec2 exitPoint=p.xz-u_hole.xy+light.xz*d/light.y;
 // A small soft allowance around the aperture saves angle/sine work on every interior pixel.
 float penumbra=4.+d*.10,sun=1.-smoothstep(u_hole.z-penumbra,u_hole.z+penumbra,length(exitPoint));
 float sky=1./sqrt(1.+pow(d/(r*.82+6.),2.));
 float diffuse=max(0.,dot(n,light));
 return .29+.34*sky+.38*diffuse*sun;
}
${TERRAIN_ALBEDO_GLSL}
${MATERIAL_DETAIL_GLSL}

void main(){
// The permanent station deck replaces the pavement below it. Coplanar tops
// otherwise alternate in the depth buffer as the camera pulls away.
#ifndef VORA_OPAQUE_ONLY
if(u_renderPass>.5){
 if(u_material==13.&&stationCoversWalkway(v_world))discard;
 if(u_material==6.||u_material==7.)discard;
 vec2 hd=v_world.xz-u_hole.xy;float hr=u_hole.z;
 if(length(hd)<hr*1.09+2.)hr=apertureRadiusAt(hd);
 if(u_renderPass<1.5&&(u_material==1.||u_material==5.||u_material==13.||u_material==15.)&&length(hd)<hr)discard;
 if((u_material==2.||u_material==3.||u_material==4.||u_material==8.||u_material==9.||u_material==10.)&&v_world.y>-${STATION.depth.toFixed(1)}&&stationDistance(v_world.xz)<0.)discard;
 gl_FragColor=packShadow(gl_FragCoord.z);gl_FragColor.a=u_material==15.?.5:u_material==13.?.625:u_material==4.?.25:1.;return;
}
#endif
// Derivatives are computed before any divergent material branch or discard.
gSurfaceNormal=normalize(v_normal);
#ifdef GL_OES_standard_derivatives
 materialFootprint=max(length(dFdx(v_world)),length(dFdy(v_world)));
 gLocalFootprint=max(length(dFdx(v_local)),length(dFdy(v_local)));
 vec3 facet=cross(dFdx(v_world),dFdy(v_world));
 if(dot(facet,facet)>.00000001){
  facet=normalize(facet);gSurfaceNormal=dot(facet,gSurfaceNormal)<0.?-facet:facet;
 }
 vec3 lightPosition=v_shadow.xyz/v_shadow.w*.5;
 vec3 sx=dFdx(lightPosition),sy=dFdy(lightPosition);
 float determinant=sx.x*sy.y-sx.y*sy.x;
 gShadowGradient=abs(determinant)>.0000000001?vec2(sy.y*sx.z-sx.y*sy.z,sx.x*sy.z-sy.x*sx.z)/determinant:vec2(0.);
#else
 gShadowGradient=vec2(0.);
 materialFootprint=max(.6,length(v_world-u_eye)*u_pixelScale/max(.22,abs(dot(normalize(v_normal),normalize(u_eye-v_world)))));
#endif
#ifdef VORA_OPAQUE_ONLY
materialWalk=-100000.;
#else
materialWalk=(u_material==0.||u_material==6.||u_material==7.||u_material==11.||u_material==14.||u_material==15.)?-100000.:walkField(v_world.xz);
#endif
vec2 holeDelta=v_world.xz-u_hole.xy;float distanceToHole=length(holeDelta);float boundaryRadius=u_hole.z;if(distanceToHole>.00001&&distanceToHole<u_hole.z*1.09+2.)boundaryRadius=apertureRadiusAt(holeDelta);
if(u_material==13.&&stationCoversWalkway(v_world))discard;
#ifndef VORA_OPAQUE_ONLY
bool cut=u_material==1.||u_material==5.||u_material==6.||u_material==13.||u_material==15.;if(cut&&distanceToHole<boundaryRadius)discard;
// The cavity meets the permanent block; its lip and lining never pass through it.
if((u_material==2.||u_material==3.||u_material==4.||u_material==8.||u_material==9.||u_material==10.)&&v_world.y>-${STATION.depth.toFixed(1)}&&stationDistance(v_world.xz)<0.)discard;
#endif
float fog = fogAmount(v_world - u_eye);
if (fog >= 1. && u_material != 6. && u_material != 7.) {
    // Fully hidden surfaces still write depth, but need no materials or shadows.
    gl_FragColor = vec4(FOG_COLOR, 1. - u_reactive);
#ifdef VORA_SURFACE_OUTPUT
    surfaceColor = vec4(.5, .5, 0., 1.);
#endif
    return;
}
vec3 color=v_color*u_tint;float alpha=1.;bool foliage=false;gGrass=0.;gMicroAO=1.;gTurfGradient=vec2(0.);gMaterialHeight=0.;
#ifdef VORA_OPAQUE_ONLY
bool interior=false;
#else
if(u_material==1.){color=ground(v_world.xz);color*=1.-.16*exp(-max(0.,distanceToHole-boundaryRadius)/2.5);}
bool interior=u_material==2.||u_material==3.||(u_material==4.&&v_world.y<0.);
if(interior){
 float d=max(0.,-v_world.y);color=layeredInterior(v_world,normalize(v_normal),u_material==3.);
 float cap=1.-smoothstep(.15,3.1+noise(v_world.xz*.035)*.4,d);
 // Ground shading has grass/contact side effects. Restrict them to the thin cap;
 // otherwise pavement boundaries imprint dark vertical seams all the way down the wall.
 if(cap>0.){vec3 topColor=ground(v_world.xz);color=mix(color,topColor,cap);gMicroAO=mix(1.,gMicroAO,cap);}
}

if(u_material==4.&&v_world.y>=0.){color=ground(v_world.xz);}

if(u_material==13.){if(!walkSurfaceVisible(v_world.xz,v_world.y,v_color.xy))discard;color=groundMaterial(v_world.xz,1.);if(v_color.y>.5)color*=.94;}
#endif
if(u_material==14.||u_material==15.){float finish=floor(v_color.b*.5+.001);foliage=finish==3.;color=vec3(v_color.r,v_color.g,v_color.b-finish*2.);if(finish==1.||finish==2.){vec3 n=normalize(v_normal),halfVector=normalize(SUN+normalize(u_eye-v_world));float shine=pow(max(0.,dot(n,halfVector)),finish==1.?42.:22.);color+=vec3(.92,.91,.81)*shine*(finish==1.?.25:.045);if(finish==1.)color+=vec3(.025,.028,.027)*max(0.,n.y);}}
#ifndef VORA_OPAQUE_ONLY
if(u_material==11.){
 vec2 woodUV=vec2(v_local.x*.07,v_local.z*.7+v_local.y*.035);
 float grain=objectGrain(vec3(woodUV.x,0.,woodUV.y),.75);
 color*=.96+grain*.08;
}
if(u_material==8.){color=chipColor(v_world);color*=mix(.98,.68,clamp(-v_world.y/max(u_depth,1.),0.,1.));}
if(u_material==9.){if(granularBiome(vec3(v_world.x,0.,v_world.z))>.5)discard;color=vec3(.48,.36,.21)*(0.8+noise(v_world.xz*1.3)*.3);}
if(u_material==10.){if(biome(v_world.xz)>.5)discard;color=vec3(.32,.54,.21)*(0.8+noise(v_world.xz*.8)*.35);}

if(u_material==6.||u_material==7.){float rr=length(v_color.xy);if(rr>1.)discard;color=vec3(.07,.09,.055);alpha=.43*(1.-smoothstep(.3,1.,rr));}
#endif
vec3 geometricNormal=normalize(v_normal),n=geometricNormal;
#ifndef VORA_OPAQUE_ONLY
// The cavity uses its actual low-poly faces, without a noisy smooth normal.
if(interior)n=gSurfaceNormal;
if(u_material==1.||(u_material==4.&&v_world.y>=0.)){
 float amp=gGrass;
 if(amp>.001){
  vec2 g=noiseGradient(v_world.xz*.075)*.075*3.4+noiseGradient(v_world.xz*.31)*.31*.65*detailVisibility(.31)+gTurfGradient;
  n=normalize(n+vec3(-g.x,0.,-g.y)*amp*.95);
 }
 n=heightNormal(n,gMaterialHeight);
}else if(u_material==13.)n=heightNormal(n,gMaterialHeight);
#endif
float diffuse=max(0.,dot(n,SUN)),shadow=1.;
if(foliage)diffuse=max(0.,(dot(n,SUN)+.18)/1.18);
if(diffuse>0.||foliage)shadow=sunVisibility(gSurfaceNormal);
if(u_material==14.||u_material==15.)color=finishedSurface(color,floor(v_color.b*.5+.001));
float ao=gMicroAO;
vec3 sky=mix(vec3(.25,.29,.285),vec3(.43,.53,.62),clamp(n.y*.5+.5,0.,1.));
vec3 bounce=vec3(.065,.10,.055)*(1.-max(0.,n.y));
float lightVisibility=foliage?mix(.16,1.,shadow):shadow;
vec3 direct=vec3(1.10,1.035,.91)*diffuse*.91*lightVisibility;
if(foliage){
 // The opposite side of thin leaves transmits a little warm sunlight.
 direct+=vec3(.39,.56,.22)*pow(max(0.,dot(-n,SUN)),1.3)*.32*lightVisibility;
 ao*=.91;
}
bool buried=interior||((u_material==0.||u_material==11.||u_material==14.)&&v_world.y<0.&&distanceToHole<boundaryRadius);
if(buried){
 float d=max(0.,-v_world.y),r=max(1.,u_hole.z),enclosed=smoothstep(0.,5.,d);
 float skyView=1./sqrt(1.+pow(d/(r*.78+3.),2.));
 float wallContact=pow(clamp(distanceToHole/r,0.,1.),2.)*smoothstep(.04,.35,d/max(1.,u_depth));
 float cavityAO=clamp(.22+.78*skyView-wallContact*.12,.18,1.);
 ao*=mix(1.,cavityAO,enclosed);
 vec2 exitPoint=v_world.xz-u_hole.xy+SUN.xz*d/SUN.y;
 // Ray visibility through the actual opening provides a continuous cavity shadow.
 // The live map contributes object/lip shadows, not the lining's triangle edges.
 float opening=apertureRadiusAt(exitPoint),sunOpening=1.-smoothstep(opening-2.-d*.04,opening+2.+d*.04,length(exitPoint));
 direct*=mix(1.,sunOpening,enclosed);
 sky=mix(sky,vec3(.28,.32,.34),enclosed);
 bounce+=vec3(.055,.032,.013)*enclosed;
}
float ambientShare=clamp(dot(color*(sky+bounce)*ao,vec3(.2126,.7152,.0722))/max(dot(color*((sky+bounce)*ao+direct),vec3(.2126,.7152,.0722)),.0001),0.,1.);
color*=(sky+bounce)*ao+direct;
if(u_material!=6.&&u_material!=7.){
 float lum=dot(color,vec3(.2126,.7152,.0722));color=mix(vec3(lum),color,1.055);
 color=color*(1.08+color*.06)/(1.+color*.20);
 color=mix(color,FOG_COLOR,fog);
}
gl_FragColor=vec4(color,alpha*(1.-u_reactive));
#ifdef VORA_SURFACE_OUTPUT
 vec3 octN=gSurfaceNormal/(abs(gSurfaceNormal.x)+abs(gSurfaceNormal.y)+abs(gSurfaceNormal.z));
 vec2 oct=octN.z>=0.?octN.xy:(1.-abs(octN.yx))*vec2(octN.x>=0.?1.:-1.,octN.y>=0.?1.:-1.);
 surfaceColor=vec4(oct*.5+.5,ambientShare,alpha);
#endif
}
