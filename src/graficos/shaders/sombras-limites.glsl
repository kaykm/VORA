// Conservative min/max bounds for a complete 4x4 PCF footprint. Ambiguous
// regions still run every original tap, including aperture and grazing rules.
float boundedShadowVisibility(vec3 q,vec2 base,float texel,float cell,vec2 gradient,float bias){
 if(any(lessThan(base,vec2(0.)))||any(greaterThanEqual((base+3.)*texel,vec2(1.))))return -1.;
 vec2 lo=floor(base*.25),hi=floor((base+3.)*.25),step=vec2(texel*4.);
 vec4 a=texture2D(u_shadowBoundsMap,(lo+.5)*step);
 vec4 b=texture2D(u_shadowBoundsMap,(vec2(hi.x,lo.y)+.5)*step);
 vec4 c=texture2D(u_shadowBoundsMap,(vec2(lo.x,hi.y)+.5)*step);
 vec4 d=texture2D(u_shadowBoundsMap,(hi+.5)*step);
 vec2 decode=vec2(65280.,255.)/65535.;
 float nearest=min(min(dot(a.rg,decode),dot(b.rg,decode)),min(dot(c.rg,decode),dot(d.rg,decode)));
 float farthest=max(max(dot(a.ba,decode),dot(b.ba,decode)),max(dot(c.ba,decode),dot(d.ba,decode)));
 float plane=dot(abs(gradient),vec2(2.5*texel)),limit=cell*1.5/shadowDepthRange();
 float transition=(.035+min(.08,cell*.025))/shadowDepthRange();
 // Expanded bounds and a final arithmetic margin can only reject shortcuts.
 if(nearest>=q.z+min(plane,limit)-bias+transition+.0000002)return 1.;
 if(plane<=limit&&farthest<=q.z-plane-bias-transition-.0000002)return 0.;
 return -1.;
}
