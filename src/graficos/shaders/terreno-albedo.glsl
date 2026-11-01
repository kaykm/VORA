
// Overlapping tapered fibers, with filtered edges and analytic blade normals.
vec3 turfFibers(vec2 p){
 vec4 fiber=texture2D(u_turfMap,p/96.);
 gTurfGradient=(fiber.ba*2.-1.)*.70;
 return vec3(fiber.r,fiber.g,fiber.r*.70);
}
vec3 grassColor(vec2 p){
 float macro=noise(p*.0065+vec2(3.1,-7.4)),meso=noise(p*.026+vec2(-11.,5.));
 float clumps=filteredNoise(p,.13),grain=filteredNoise(p,.62);
 float dry=smoothstep(.53,.79,noise(p*.011+vec2(41.,9.)));
 // Fresh shaded greens and sunlit lime retain the broad patches of the turf.
 vec3 c=mix(vec3(.155,.335,.130),vec3(.37,.575,.235),smoothstep(.16,.83,meso*.64+macro*.36));
 c=mix(c,vec3(.54,.59,.28),dry*.22);
 float thatch=smoothstep(.58,.81,filteredNoise(p+vec2(71.,-3.),.18));
 float bare=smoothstep(.68,.85,noise(p*.075+vec2(17.,21.)))*smoothstep(.38,.70,meso);
 c=mix(c,vec3(.38,.27,.145),bare*.58);
 c*=.94+clumps*.14+(grain-.5)*.045;
 vec3 fibers=turfFibers(p);
 vec3 blade=mix(vec3(.29,.48,.16),vec3(.61,.71,.33),clamp(fibers.y*.65+dry*.28,0.,1.));
 c=mix(c,blade,fibers.x*.58*(1.-bare*.65));
 c=mix(c,vec3(.61,.49,.275),thatch*.10*(1.-fibers.x*.7));
 float mowed=.5+.5*smoothstep(.3,.6,noise(p*.004+vec2(13.,-5.)));
 float stripe=smoothstep(-.4,.4,sin(dot(p,vec2(.8,.6))/46.*3.14159));
 c*=1.+(stripe-.5)*.055*mowed;
 float foot=trailWeight(p)*(.25+.32*noise(p*.075))*smoothstep(.28,.68,noise(p*.032+vec2(11.,-3.)));
 c=mix(c,vec3(.48,.33,.19),foot);
 float contact=(1.-smoothstep(.2,3.,abs(materialWalk)))*.18+(1.-smoothstep(0.,13.,max(0.,-materialWalk)))*.07*step(materialWalk,0.);
 gMicroAO=clamp(1.-(1.-clumps)*.16-fibers.z*(1.-fibers.x)*.17-bare*.08-contact,.57,1.);
 return c*(1.-contact*.5);
}
// Sandstone slabs: recessed joints, small aggregate and subdued mineral grain.
vec4 paveSlab(vec2 al,vec2 p,float cw,float L,float seed){
 float u=al.y/cw+.5,col=floor(u),fc=u-col;
 float v=al.x/L+mod(col,2.)*.5,row=floor(v),fr=v-row;
 float joint=min(min(fc,1.-fc)*cw,min(fr,1.-fr)*L);
 float cell=hash(vec2(col+seed,row+seed*1.7));
 float aa=max(.10,materialFootprint*.65),visible=1.-smoothstep(1.2,4.,materialFootprint);
 float seam=(1.-smoothstep(.16-aa*.4,.48+aa,joint))*visible;
 float bevel=(1.-smoothstep(.35,1.25,joint))*visible;
 float mineral=filteredNoise(p+vec2(cell*31.,seed),.18),grit=filteredNoise(p,.85);
 float flecks=smoothstep(.67,.84,grit)*detailVisibility(.85);
 float weather=noise(p*.014),vein=noise(vec2(al.x*.025+mineral*.25,al.y*.075));
 vec3 stone=mix(vec3(.735,.715,.640),vec3(.68,.53,.39),smoothstep(.84,.98,cell)*.22);
 stone*=1.+(cell-.5)*.065+(weather-.5)*.045+(mineral-.5)*.045+(vein-.5)*.025;
 stone=mix(stone,stone*vec3(.78,.80,.81),flecks*.18);
 stone=mix(stone,vec3(.43,.435,.385),seam*.56);stone*=1.-bevel*.045;
 float height=-.18*seam-.10*bevel+(mineral-.5)*.055+(grit-.5)*.045;
 return vec4(stone,height);
}
vec4 pavementCore(vec2 p){
 vec2 a=walkRoute(p.y,0.),b=walkRoute(p.x,1.);
 vec2 d=p+vec2(40.),e=d/vec2(620.,500.);float q=length(e),g=length(d/vec2(384400.,250000.));
 float fV=clamp(a.y-abs(p.x-a.x),-60.,60.),fH=clamp(b.y-abs(p.y-b.x),-60.,60.),fM=clamp(36.-abs(q-1.)*q/max(g,.000001),-60.,60.);
 float wV=exp(fV*.3),wH=exp(fH*.3),wM=exp(fM*.3),sum=wV+wH+wM;wV/=sum;wH/=sum;wM/=sum;
 vec4 c=vec4(0.);float ws=0.;
 if(wV>.01){float m=(walkRoute(p.y+1.,0.).x-walkRoute(p.y-1.,0.).x)*.5,x=p.x-a.x;c+=paveSlab(vec2(p.y+m*x,x*45./a.y),p,30.,64.,0.)*wV;ws+=wV;}
 if(wH>.01){float m=(walkRoute(p.x+1.,1.).x-walkRoute(p.x-1.,1.).x)*.5,x=p.y-b.x;c+=paveSlab(vec2(p.x+m*x,x*45./b.y),p,30.,64.,31.)*wH;ws+=wH;}
 if(wM>.01){float across=(q-1.)*q/max(g,.000001);c+=paveSlab(vec2(atan(e.y,e.x)*560.,across),p,24.,52.,67.)*wM;ws+=wM;}
 return c/max(ws,.001);
}
vec4 pavement(vec2 p){
 if(max(abs(p.x),abs(p.y))<900.)return pavementCore(p);
 float o=outerWalkField(p),inner=roundWalk(primaryWalkField(p),meadowWalkField(p),24.),t=smoothstep(-12.,12.,o-inner);if(t<.001)return pavementCore(p);
 vec2 d=p+vec2(40.),e=d/vec2(1700.,1500.);float q=length(e),g=max(length(d/vec2(2890000.,2250000.)),.000001);vec4 c=paveSlab(vec2(atan(e.y,e.x)*1600.,(q-1.)*q/g),p,24.,58.,109.);if(t>.999)return c;return mix(pavementCore(p),c,t);
}
vec3 groundMaterial(vec2 p,float b){
 gMaterialHeight=0.;
 if(b<.5)return grassColor(p);
 if(b<1.5){
  vec4 surface=pavement(p);gMaterialHeight=surface.a;
  float edge=1.-smoothstep(1.4,3.7,materialWalk);
  return mix(surface.rgb,vec3(.80,.78,.69),edge*.38);
 }
 bool sand=b>2.5;
 float broad=noise(p*.035),grain=filteredNoise(p,.32),grit=filteredNoise(p,1.1);
 float drift=noise(vec2(p.x*.018+p.y*.007,p.y*.07));
 float pores=smoothstep(.70,.86,grit)*detailVisibility(1.1);
 vec3 lo=sand?vec3(.77,.655,.445):vec3(.46,.295,.185);
 vec3 hi=sand?vec3(.89,.79,.59):vec3(.65,.455,.295);
 vec3 color=mix(lo,hi,broad*.72+drift*.28)+(grain-.5)*.035;
 color*=1.-pores*(sand?.045:.10);
 gMaterialHeight=(grain-.5)*(sand?.10:.20)-pores*.07;
 return color;
}
vec4 topWeights(vec2 p){vec4 w=surfaceWeights(p);float aa=max(.16,materialFootprint*.55),paving=smoothstep(-aa,aa,materialWalk),sum=1.-w.y;if(sum>.00001){w.xzw=w.xzw/sum*(1.-paving);}else{w.xzw=vec3(1.-paving,0.,0.);}w.y=paving;return w;}
vec3 ground(vec2 p){
 float foundation=stationWeight(vec3(p.x,0.,p.y));
 if(foundation>=1.)return stationSurface(p);
 vec4 w=topWeights(p);gGrass=w.x*(1.-foundation);
 vec3 color=vec3(0.);float height=0.;
 if(w.x>0.){color+=groundMaterial(p,0.)*w.x;height+=gMaterialHeight*w.x;}
 if(w.y>0.){color+=groundMaterial(p,1.)*w.y;height+=gMaterialHeight*w.y;}
 if(w.z>0.){color+=groundMaterial(p,2.)*w.z;height+=gMaterialHeight*w.z;}
 if(w.w>0.){color+=groundMaterial(p,3.)*w.w;height+=gMaterialHeight*w.w;}
 gMaterialHeight=height*(1.-foundation);gMicroAO=mix(1.,gMicroAO,gGrass);
 if(foundation>0.)color=mix(color,stationSurface(p),foundation);
 return color;
}
