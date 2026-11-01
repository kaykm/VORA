const colors={wood:[.55,.43,.28],trunk:[.38,.29,.19],leaves:[.36,.47,.25],metal:[.45,.51,.41],stone:[.55,.59,.48],box:[.66,.52,.34],pot:[.67,.40,.28]};
function terrainAt(x,y){if(walkFieldAt(x,y)>0)return'pedra';const r=regionFieldsAt(x,y);if(r[0]>0)return'terra';if(r[1]>0)return'areia';return'grama'}
function granularTerrainAt(x,z,height=0){const d=Math.max(0,-height),broad=coherentNoise(x*.035,z*.035),detail=coherentNoise(x*.075,z*.075),edge=(coherentNoise(x*.14,z*.14)-.5)*5+(detail-.5)*1.0;const regions=regionFieldsAt(x,z);let surface='grama';if(regions[0]+edge>0)surface='terra';if(regions[1]+edge>0)surface='areia';if(walkFieldAt(x,z)+edge>0)surface='pedra';const boundary=2.4+(broad-.5)*.4+(detail-.5)*.2;if(surface==='pedra'&&d<boundary)return'pedra';const topsoil=surface==='pedra'?20:surface==='areia'?36:19,clay=surface==='areia'?78:60,rock=108+(broad-.5)*23+(coherentNoise(x*.08,z*.08)-.5)*9,relief=(broad-.5)*9+(detail-.5)*1.2;if(d<topsoil+relief)return surface==='areia'?'areia':'grama';if(d<clay+relief)return'terra';if(d<rock){const inclusions=coherentNoise(x*.055+17.3,z*.055-8.1);return inclusions>.70-(d-clay)/Math.max(1,rock-clay)*.4?'pedra':'terra'}return'pedra'}
function fract(v){return v-Math.floor(v)}
function debrisColorAt(x,z,height=0){const type=granularTerrainAt(x,z,height),q=fract(Math.sin(Math.floor(x*3+height)*127.1+Math.floor(z*3+height)*311.7)*43758.5453),c=type==='grama'?[102,79,46]:type==='pedra'?[150,153,138]:type==='terra'?[133,82,43]:[196,166,107],shade=(.83+q*.30)*(height<0?.98-.30*Math.min(1,-height/Math.max(1,cavityDepth())):1);return c.map(v=>v*shade)}
function materialHash(x,y){return fract(Math.sin(x*127.1+y*311.7)*43758.5453)}
function stoneCell2(x,y){const X=Math.floor(x),Y=Math.floor(y),fx=x-X,fy=y-Y;let first=99,second=99,seed=0;for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++){const a=X+i,b=Y+j,dx=i+materialHash(a,b)*.72+.14-fx,dy=j+materialHash(a+19.7,b+37.2)*.72+.14-fy,q=dx*dx+dy*dy;if(q<first){second=first;first=q;seed=materialHash(a+8.2,b+4.7)}else if(q<second)second=q}return[Math.sqrt(first),Math.sqrt(second)-Math.sqrt(first),seed]}
function smoothRange(a,b,v){const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)}
// CPU fallback and cutaway use the same world-anchored material palette.
function textureVisibility(frequency,footprint=1.1){return 1-smoothRange(.22,.80,footprint*frequency)}
function filteredMaterialNoise(x,y,frequency,footprint=1.1){return .5+(coherentNoise(x*frequency,y*frequency)-.5)*textureVisibility(frequency,footprint)}
function planarInteriorColor(x,y,type,d,isFloor,footprint=1.1){
 const f=(x,y,k)=>filteredMaterialNoise(x,y,k,footprint),rx=x*.8-y*.6,ry=x*.6+y*.8,macro=f(x+23,y-11,.037),grain=f(rx,ry,.38),aggregate=f(x+17,y+6,.13)*.64+f(rx-8,ry+12,.25)*.36,shape=smoothRange(.08,.92,aggregate),pore=smoothRange(.71,.88,grain)*textureVisibility(.38,footprint),mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);let c;
 if(type==='grama'){
  c=mix([.285,.197,.122],[.49,.355,.225],macro*.40+shape*.60);c=c.map((v,i)=>v*(1-pore*.11)+[.115,.080,.048][i]*(grain-.5));
 }else if(type==='pedra'){
  const stone=smoothRange(.58,.75,aggregate)*textureVisibility(.145,footprint);c=mix([.50,.505,.445],[.70,.685,.575],macro);c=mix(c,[.39,.405,.355],stone*.28);c=c.map(v=>v*(1-pore*.12)+(grain-.5)*.035);
 }else if(type==='terra'){
  const sediment=f(x*.42,y,.105);c=mix([.45,.271,.155],[.67,.435,.265],shape*.55+macro*.45);c=c.map((v,i)=>v*(.955+sediment*.09)*(1-pore*.08)+[.11,.072,.044][i]*(grain-.5));
 }else if(type==='areia'){
  const drift=f(x*.35,y,.10);c=mix([.66,.535,.345],[.84,.715,.505],macro*.5+aggregate*.5);c=c.map(v=>v*(.96+drift*.08)+(grain-.5)*.025);
 }else if(type==='subsolo'){
  const mineral=smoothRange(.59,.78,aggregate)*textureVisibility(.145,footprint);c=mix([.405,.330,.235],[.62,.515,.365],macro);c=mix(c,[.64,.60,.47],mineral*.24);c=c.map(v=>v*(1-pore*.10)+(grain-.5)*.06);
 }else{
  const cell=stoneCell2(x*.045,y*.072+(macro-.5)*.30),aa=Math.max(.016,footprint*.055),seam=(1-smoothRange(.022,.055+aa,cell[1]))*smoothRange(.42,.70,macro)*textureVisibility(.10,footprint),facet=smoothRange(.05,.68,cell[0]);c=mix([.355,.375,.330],[.57,.555,.455],macro*.65+aggregate*.35);c=c.map((v,i)=>(v*(.94+aggregate*.11)+[.035,.028,.018][i]*facet)*(1-seam*.18)*(1-pore*.065)+(grain-.5)*.035);
 }
 return c;
}
const interiorTextureCache=new Map();
function sampleInteriorTexture(x,y,type,d,isFloor){
 // Bilinear samples, never nearest-neighbor jumps as a wall advances through the field.
 const scale=.8,X=x*scale,Y=y*scale,ix=Math.floor(X),iy=Math.floor(Y),fx=X-ix,fy=Y-iy,out=[0,0,0];
 for(let j=0;j<2;j++)for(let i=0;i<2;i++){const key=type+':'+(ix+i)+':'+(iy+j);let c=interiorTextureCache.get(key);if(!c){if(interiorTextureCache.size>90000)interiorTextureCache.clear();c=planarInteriorColor((ix+i)/scale,(iy+j)/scale,type,d,isFloor);interiorTextureCache.set(key,c)}const weight=(i?fx:1-fx)*(j?fy:1-fy);for(let k=0;k<3;k++)out[k]+=c[k]*weight}return out;
}
function interiorWeightsAt(x,z,height){
 const d=Math.max(0,-height),surface=surfaceWeightsAt(x,z),jitter=(coherentNoise(x*.00875,z*.00875)-.5)*1.2+(coherentNoise(x*.01875,z*.01875)-.5)*.45,lo=[16.5,1.8,16.5,33.5],hi=[21.5,3,21.5,38.5],bottom=[60,60,60,78],weights=[0,0,0,0,0,0],rock=smoothRange(100+jitter*1.5,116+jitter*1.5,d);
 for(let k=0;k<4;k++){const top=smoothRange(lo[k]+jitter,hi[k]+jitter,d),lower=smoothRange(bottom[k]-5+jitter,bottom[k]+5+jitter,d);weights[k]+=surface[k]*(1-top);weights[2]+=surface[k]*top*(1-lower);weights[4]+=surface[k]*top*lower*(1-rock);weights[5]+=surface[k]*top*lower*rock}return weights;
}
function cavityLightAt(x,z,height,normal){
 const d=Math.max(0,-height),r=Math.max(1,physicalRadius()),lx=-.465242105,ly=.837435789,lz=.325669474,ex=x-player.x+lx*d/ly,ez=z-player.y+lz*d/ly,edge=apertureRadius(Math.atan2(ez,ex)),penumbra=2.5+d*.10,sun=1-smoothRange(edge-penumbra,edge+penumbra,Math.hypot(ex,ez)),sky=1/Math.sqrt(1+(d/(r*.82+6))**2),len=Math.hypot(...normal)||1,diffuse=Math.max(0,(normal[0]*lx+normal[1]*ly+normal[2]*lz)/len);return .29+.34*sky+.38*diffuse*sun;
}
function surfaceWeightsAt(x,z){const regions=regionFieldsAt(x,z),edge=(coherentNoise(x*.035,z*.035)-.5)*2.2+(coherentNoise(x*.11,z*.11)-.5)*.55,dirt=smoothRange(-3.5,3.5,regions[0]+edge),sand=smoothRange(-3.5,3.5,regions[1]+edge),paving=smoothRange(-3.5,3.5,walkFieldAt(x,z)+edge);return[(1-dirt)*(1-sand)*(1-paving),paving,dirt*(1-sand)*(1-paving),sand*(1-paving)]}
function groundColorAt(x,z){const station=stationBlendAt(x,z);if(station>=1)return stationSurfaceAt(x,z);const w=topWeightsAt(x,z),types=['grama','pedra','terra','areia'],color=[0,0,0];for(let k=0;k<4;k++)if(w[k]>0){const c=terrainMaterialAt(x,z,types[k]);for(let i=0;i<3;i++)color[i]+=c[i]*w[k]}if(station>0){const c=stationSurfaceAt(x,z);for(let i=0;i<3;i++)color[i]+=(c[i]-color[i])*station}return color}
function interiorColorAt(x,z,height,totalDepth,isFloor=false,normal=null){
 const foundation=stationBlendAt(x,z,height),d=Math.max(0,-height),types=['grama','pedra','terra','areia','subsolo','rocha'],n=normal||(isFloor?[0,1,0]:[x-player.x,0,z-player.y]),w=n.map(v=>Math.pow(Math.abs(v),4)),sum=Math.max(.0001,w[0]+w[1]+w[2]),materialWeights=interiorWeightsAt(x,z,height),color=[0,0,0];
 if(foundation<1)for(let k=0;k<6;k++)if(materialWeights[k]>.0001){for(let j=0;j<3;j++)if(w[j]/sum>.001){const uv=j===0?[z,d]:j===1?[x,z]:[x,d],c=sampleInteriorTexture(uv[0],uv[1],types[k],d,j===1);for(let i=0;i<3;i++)color[i]+=c[i]*w[j]/sum*materialWeights[k]}}
 if(foundation>0){const concrete=stationConcreteAt(x,z,height,n);for(let i=0;i<3;i++)color[i]+=(concrete[i]-color[i])*foundation}
 const cap=1-smoothRange(.15,3.1+coherentNoise(x*.035,z*.035)*.4,d);if(cap>0){const surface=groundColorAt(x,z);for(let i=0;i<3;i++)color[i]+=(surface[i]-color[i])*cap}return color.map(v=>Math.max(0,Math.min(255,v*255)));
}

function materialCSS(x,z,height,totalDepth,isFloor=false){const shade=1+(cavityLightAt(x,z,height,[0,0,1])-1)*smoothRange(0,5,-height);return 'rgb('+interiorColorAt(x,z,height,totalDepth,isFloor,[0,0,1]).map(v=>Math.round(v*shade)).join(',')+')'}
