precision highp float;
varying vec2 v_uv;
uniform sampler2D u_color;
uniform vec2 u_inputViewport;
uniform vec2 u_resourceSize;
uniform float u_sharpness;
vec3 loadColor(vec2 p){return texture2D(u_color,clamp(p,.5/u_inputViewport,1.-.5/u_inputViewport)*u_inputViewport/u_resourceSize).rgb;}
float luma2(vec3 c){return c.g+.5*(c.r+c.b);}
void main(){
 vec2 px=1./u_inputViewport;vec3 b=loadColor(v_uv-vec2(0.,px.y)),d=loadColor(v_uv-vec2(px.x,0.)),e=loadColor(v_uv),f=loadColor(v_uv+vec2(px.x,0.)),h=loadColor(v_uv+vec2(0.,px.y));
 float B=luma2(b),D=luma2(d),E=luma2(e),F=luma2(f),H=luma2(h);
 float noise=abs(.25*(B+D+F+H)-E)/max(max(max(B,D),max(E,max(F,H)))-min(min(B,D),min(E,min(F,H))),.000001);
 noise=1.-.5*clamp(noise,0.,1.);
 vec3 lo=min(min(b,d),min(f,h)),hi=max(max(b,d),max(f,h));
 // AMD FidelityFX SDK spatial 1.2 / current RCAS lower-limiter compensation.
 // Preserve precision at a black center pixel; epsilon also makes black/white neighborhoods finite.
 float lowerLimiterMultiplier=clamp(E/max(min(min(B,D),min(F,H)),.000001),0.,1.);
 vec3 hitMin=lo/max(4.*hi,vec3(.000001))*lowerLimiterMultiplier;
 vec3 hitMax=(1.-hi)/min(4.*lo-4.,vec3(-.000001));
 vec3 bounds=max(-hitMin,hitMax);
 float lobe=max(-.1875,min(max(max(bounds.r,bounds.g),bounds.b),0.))*exp2(-u_sharpness)*noise;
 vec3 color=(lobe*(b+d+f+h)+e)/(4.*lobe+1.);
 gl_FragColor=vec4(clamp(color,0.,1.),1.);
}
