// Shared by scene shading and AO. Fog light is not an occludable surface.
const vec3 FOG_COLOR = vec3(.66, .715, .64);
const float FOG_START = 2850.;
const float FOG_END = 3850.;

float fogAmount(vec3 viewPosition) {
    return smoothstep(FOG_START, FOG_END, length(viewPosition));
}

vec3 occludeFoggedSurface(vec3 color, float fog, float visibility, float ambient) {
    // color = surface * transmittance + fog light. Darken only the first term.
    // This is equivalent to applying AO before fog, including at full extinction.
    vec3 surface = max(color - FOG_COLOR * fog, vec3(0.));
    float obscured = (1. - visibility) * clamp(ambient, 0., 1.);
    return color - surface * obscured;
}
