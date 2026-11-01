precision highp float;
varying vec2 v_uv;
uniform sampler2D u_color;
uniform sampler2D u_history;
uniform sampler2D u_depth;
uniform sampler2D u_reactive;
uniform vec2 u_inputViewport;
uniform vec2 u_resourceSize;
uniform mat4 u_inverseVP;
uniform mat4 u_previousVP;
uniform float u_historyValid;
uniform vec2 u_jitter;
uniform vec2 u_previousJitter;
vec3 ycocg(vec3 c){return vec3(dot(c,vec3(.25,.5,.25)),.5*(c.r-c.b),-.25*c.r+.5*c.g-.25*c.b);}
vec3 rgb(vec3 c){return vec3(c.x+c.y-c.z,c.x+c.z,c.x-c.y-c.z);}
vec2 safeUV(vec2 uv){return clamp(uv,.5/u_inputViewport,1.-.5/u_inputViewport)*u_inputViewport/u_resourceSize;}
void main(){
 vec2 sampleUV=v_uv+u_jitter,uv=safeUV(sampleUV),px=1./u_inputViewport;
 vec3 color=texture2D(u_color,uv).rgb;float raw=texture2D(u_depth,uv).r;
 vec4 world=u_inverseVP*vec4(sampleUV*2.-1.,raw*2.-1.,1.);world/=max(abs(world.w),.000001);
 vec4 oldClip=u_previousVP*vec4(world.xyz,1.);vec2 prevUV=oldClip.xy/max(oldClip.w,.000001)*.5+.5-u_previousJitter;
 float depth=16000./(4002.-(raw*2.-1.)*3998.);
 float reactive=1.-texture2D(u_reactive,uv).a;
 bool valid=u_historyValid>.5&&raw<.99999&&oldClip.w>0.&&reactive<.1&&all(greaterThan(prevUV,vec2(0.)))&&all(lessThan(prevUV,vec2(1.)));
 if(valid){
  vec4 history=texture2D(u_history,safeUV(prevUV));
  valid=history.a>0.&&abs(history.a-oldClip.w)<max(.45,oldClip.w*.004);
  if(valid){
   vec3 low=ycocg(color),high=low,average=vec3(0.);float count=0.;
   for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
    vec3 c=ycocg(texture2D(u_color,safeUV(sampleUV+vec2(float(x),float(y))*px)).rgb);
    low=min(low,c);high=max(high,c);average+=c;count+=1.;
   }
   average/=count;vec3 historical=clamp(ycocg(history.rgb),low,high);
   float motion=length((prevUV-v_uv)*u_inputViewport),contrast=high.x-low.x;
   float trust=mix(.88,.65,clamp(motion/12.,0.,1.));trust*=1.-clamp(abs(historical.x-ycocg(color).x)/max(.04,contrast),0.,1.)*.25;
   color=rgb(mix(ycocg(color),historical,trust));
  }
 }
 gl_FragColor=vec4(clamp(color,0.,1.),reactive>.1?-depth:depth);
}
