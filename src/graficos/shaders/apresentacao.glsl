precision highp float;varying vec2 v_uv;
uniform sampler2D u_color;uniform vec2 u_inputViewport;uniform vec2 u_resourceSize;
void main(){gl_FragColor=vec4(texture2D(u_color,clamp(v_uv,.5/u_inputViewport,1.-.5/u_inputViewport)*u_inputViewport/u_resourceSize).rgb,1.);}
