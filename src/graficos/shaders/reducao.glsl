precision highp float;varying vec2 v_uv;
uniform sampler2D u_color;uniform vec2 u_inputViewport;uniform vec2 u_resourceSize;uniform vec2 u_outputSize;
vec3 readColor(vec2 p){return texture2D(u_color,clamp(p,.5/u_inputViewport,1.-.5/u_inputViewport)*u_inputViewport/u_resourceSize).rgb;}
void main(){vec2 d=.25/u_outputSize;vec3 a=readColor(v_uv+vec2(-d.x,-d.y)),b=readColor(v_uv+vec2(d.x,-d.y)),c=readColor(v_uv+vec2(-d.x,d.y)),e=readColor(v_uv+d);gl_FragColor=vec4(sqrt(max(vec3(0.),(a*a+b*b+c*c+e*e)*.25)),1.);}
