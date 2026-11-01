precision highp float;
uniform highp sampler2D u_color;
uniform vec2 u_inputViewport;
void main(){
 vec2 first=floor(gl_FragCoord.xy)*4.+.5;
 float nearest=1.,farthest=0.;
 for(int y=0;y<4;y++)for(int x=0;x<4;x++){
  vec4 value=texture2D(u_color,(first+vec2(float(x),float(y)))/u_inputViewport);
  float depth=clamp(dot(value.rgb,vec3(1.,1./255.,1./65025.)),0.,1.);
  // Tagged plants can disappear through the moving opening. Their blocks
  // deliberately remain ambiguous until the regular per-tap test runs.
  nearest=min(nearest,value.a<.75?0.:depth);
  farthest=max(farthest,value.a<.75?1.:depth);
 }
 float low=max(0.,floor(nearest*65535.)-1.);
 float high=min(65535.,ceil(farthest*65535.)+1.);
 gl_FragColor=vec4(floor(low/256.),mod(low,256.),floor(high/256.),mod(high,256.))/255.;
}
