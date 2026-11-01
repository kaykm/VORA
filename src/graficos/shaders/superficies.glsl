// Object-space detail follows the object while it rotates, falls or is carried.
// Subpixel grain fades out instead of producing sparkling noise at distant zoom.
float objectGrain(vec3 p,float frequency){
 float visible=1.-smoothstep(.20,.75,gLocalFootprint*frequency);
 if(visible<=0.)return .5;
 return .5+(noise((p.xz+p.y*vec2(.37,.61))*frequency)-.5)*visible;
}
vec3 finishedSurface(vec3 color,float finish){
 if(finish==3.)return color;
 float grain=objectGrain(v_local,finish==1.?1.8:.72);
 float amount=finish==1.?.018:finish==2.?.025:.045;
 return color*(1.+(grain-.5)*amount);
}
vec3 heightNormal(vec3 normal,float height){
#ifdef GL_OES_standard_derivatives
 vec3 x=dFdx(v_world),y=dFdy(v_world);
 vec3 a=cross(y,gSurfaceNormal),b=cross(gSurfaceNormal,x);
 float determinant=dot(x,a);
 vec3 gradient=(a*dFdx(height)+b*dFdy(height))*sign(determinant)/max(abs(determinant),.000001);
 gradient-=normal*dot(normal,gradient);
 gradient/=max(1.,length(gradient));
 return normalize(normal-gradient);
#else
 return normal;
#endif
}
