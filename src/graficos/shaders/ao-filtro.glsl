precision highp float;
varying vec2 v_uv;
${FOG_GLSL}
uniform highp sampler2D u_color;
${AO_SURFACE_GLSL}

void main(){
 vec4 center=aoLoad(u_color,v_uv);float z=unpackAODepth(center);
 if(z>3995.){gl_FragColor=center;return;}
 vec2 anchor=aoAnchor(v_uv,center);
 vec3 p=aoPosition(anchor,z);
 if (fogAmount(p) >= 1.) { gl_FragColor=center; return; }
 vec3 n=aoNormal(anchor,p);
 float total=center.r*2.,weight=2.;
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){
  if(x==0&&y==0)continue;
  vec2 uv=v_uv+vec2(float(x),float(y))/u_aoViewport;
  if(any(lessThan(uv,vec2(0.)))||any(greaterThan(uv,vec2(1.))))continue;
  vec4 value=aoLoad(u_color,uv);float spatial=(x==0||y==0)?1.:.6;
  float w=aoSurfaceWeight(p,n,uv,value)*spatial;
  total+=value.r*w;weight+=w;
 }
 gl_FragColor=vec4(total/weight,center.gba);
}
