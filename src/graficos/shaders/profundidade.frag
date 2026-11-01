precision highp float;
// Coverage-only shader. Color writes are disabled; no material, noise or shadow
// lookup runs here. Opaque models contain no alpha cutouts or procedural holes.
void main(){gl_FragColor=vec4(0.);}
