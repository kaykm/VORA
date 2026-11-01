// A real 3D scene: the ground is cut in world space and the depth buffer resolves occlusion.
const FOG_GLSL = /* @text src/graficos/shaders/nevoa.glsl */;
const vertexSource=/* @text src/graficos/shaders/cena.vert */;
const SHADOW_BOUNDS_GLSL=/* @text src/graficos/shaders/sombras-limites.glsl */;
const MATERIAL_DETAIL_GLSL=/* @text src/graficos/shaders/superficies.glsl */;
const fragmentSource=/* @template src/graficos/shaders/cena.frag */;
