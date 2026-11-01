
vec2 walkRoute(float t,float axis){float q=t+40.,e=smoothstep(axis>.5?100.:160.,axis>.5?320.:340.,abs(q));return vec2(-40.+e*(18.*sin(q*.0045+.4+axis*.8)+9.*sin(q*.009-1.)),45.+e*3.*sin(q*.006+1.2));}
float roundWalk(float a,float b,float r){return min(-r,max(a,b))+length(max(vec2(r)+vec2(a,b),vec2(0.)));}
vec2 walkDistances(vec2 p){vec2 a=walkRoute(p.y,0.),b=walkRoute(p.x,1.);return vec2(a.y-abs(p.x-a.x),b.y-abs(p.y-b.x));}
float primaryWalkField(vec2 p){vec2 d=walkDistances(p);return roundWalk(d.x,d.y,30.);}
float meadowWalkField(vec2 p){vec2 d=p+vec2(40.);if(d.x<0.)return 36.-length(d-vec2(0.,500.));if(d.y<0.)return 36.-length(d-vec2(620.,0.));float q=length(d/vec2(620.,500.)),g=length(d/vec2(384400.,250000.));return 36.-abs(q-1.)*q/max(g,.000001);}
float outerWalkField(vec2 p){vec2 d=p+vec2(40.);float q=length(d/vec2(1700.,1500.)),g=length(d/vec2(2890000.,2250000.));return 30.-abs(q-1.)*q/max(g,.000001);}
float walkField(vec2 p){float inner=roundWalk(primaryWalkField(p),meadowWalkField(p),24.);return max(abs(p.x),abs(p.y))<900.?inner:roundWalk(inner,outerWalkField(p),20.);}
bool walkSurfaceVisible(vec2 p,float y,vec2 part){return true;}
vec2 regionFields(vec2 p){float n=(noise(p*.009+vec2(23.,-7.))-.5)*36.,m=(noise(p*.008+vec2(-17.,4.))-.5)*42.;vec2 core=vec2(100.-length(max(vec2(345.,220.)-p,vec2(0.)))+n,145.-length(max(vec2(405.,325.)+p,vec2(0.)))+m);float t=max(abs(p.x),abs(p.y))<880.?0.:smoothstep(1240.,1550.,length(p)+n*2.);if(t==0.)return core;float dirt=max(max(260.-length(p-vec2(1460.,-980.)),280.-length(p-vec2(1430.,1220.))),210.-length(p-vec2(-1150.,1300.)))+n,sand=280.-length(p-vec2(-1400.,-1180.))+m;return mix(core,vec2(dirt,sand),t);}
float trailWeight(vec2 p){float center=205.+32.*sin(p.y*.006-.2),width=5.+2.*sin(p.y*.013+.8),d=abs(p.x-center)-width;return (1.-smoothstep(-1.,2.,d))*smoothstep(25.,70.,p.y)*(1.-smoothstep(540.,620.,p.y));}
