
attribute vec3 a_position;attribute vec3 a_normal;attribute vec3 a_color;
attribute vec3 a_instanceOrigin;attribute vec3 a_instanceScale;attribute float a_instanceRotation;
uniform float u_instanced;
uniform mat4 u_viewProjection;uniform vec3 u_origin;uniform vec3 u_scale;uniform float u_rotation;uniform mat4 u_bodyRotation;uniform vec3 u_pivot;
varying vec3 v_world;varying vec3 v_normal;varying vec3 v_color;varying vec3 v_local;
invariant gl_Position;
uniform mat4 u_lightViewProjection;varying vec4 v_shadow;
void main(){
 vec3 origin=u_origin,scale=u_scale;float rotation=u_rotation;
 if(u_instanced>.5){origin=a_instanceOrigin;scale=a_instanceScale;rotation=a_instanceRotation;}
 float c=cos(rotation),s=sin(rotation);
 vec3 p=a_position*scale,n=normalize(a_normal/scale);
 p=vec3(c*p.x+s*p.z,p.y,-s*p.x+c*p.z);n=vec3(c*n.x+s*n.z,n.y,-s*n.x+c*n.z);
 v_world=(u_bodyRotation*vec4(p+origin-u_pivot,1.0)).xyz+u_pivot;
 v_normal=(u_bodyRotation*vec4(n,0.0)).xyz;v_color=a_color;
 v_local=a_position;
 v_shadow=u_lightViewProjection*vec4(v_world,1.0);gl_Position=u_viewProjection*vec4(v_world,1.0);
}
