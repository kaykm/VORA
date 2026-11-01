"""Reproduz AO sobre geometria facetada em uma GPU OpenGL ES real.

Preparação: node scripts/preparar-gpu.mjs
Uso: python scripts/testar-iluminacao.py --angle-dir "pasta do ANGLE"

O fixture rasteriza copas convexas, copas sobrepostas e chão com profundidade
e normais reais. Os três passes de AO vêm das strings efetivamente usadas no
jogo, antes e depois. Não abre navegador nem acessa saves. Usa só a biblioteca
padrão do Python e as DLLs locais explicitamente indicadas.
"""
import argparse
import ctypes as C
import importlib.util
import json
import math
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('vora_gpu', ROOT / 'scripts' / 'testar-gpu.py')
GPU = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GPU)
EGL, ShaderTest, write_png = GPU.EGL, GPU.ShaderTest, GPU.write_png


FIXTURE_VERTEX = """#version 300 es
precision highp float;
in vec3 a_position;
in vec3 a_normal;
in vec3 a_color;
in float a_kind;
uniform vec2 u_projection;
out vec3 v_normal;
out vec3 v_color;
flat out float v_kind;
out float v_depth;
void main() {
  float near = 2., far = 4000.;
  gl_Position = vec4(a_position.xy / u_projection,
    -(far + near) / (far - near) * a_position.z - 2. * far * near / (far - near),
    -a_position.z);
  v_normal = a_normal;
  v_color = a_color;
  v_kind = a_kind;
  v_depth = -a_position.z;
}
"""


FIXTURE_FRAGMENT = """#version 300 es
precision highp float;
in vec3 v_normal;
in vec3 v_color;
flat in float v_kind;
in float v_depth;
layout(location=0) out vec4 sceneColor;
layout(location=1) out vec4 surface;
layout(location=2) out vec4 metadata;
vec2 octahedron(vec3 n) {
  n /= abs(n.x) + abs(n.y) + abs(n.z);
  vec2 f = n.xy;
  if (n.z < 0.) f = (1. - abs(f.yx)) * vec2(f.x >= 0. ? 1. : -1., f.y >= 0. ? 1. : -1.);
  return f * .5 + .5;
}
void main() {
  vec3 n = normalize(v_normal);
  float light = .58 + .42 * max(0., dot(n, normalize(vec3(-.6, .8, .7))));
  sceneColor = vec4(v_color * light, 1.);
  surface = vec4(octahedron(n), .65, 1.);
  float z = floor(v_depth / 4000. * 65535. + .5);
  metadata = vec4(v_kind / 255., floor(z / 256.) / 255., mod(z, 256.) / 255., 1.);
}
"""


def subtract(a, b):
    return tuple(x - y for x, y in zip(a, b))


def cross(a, b):
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def normalize(a):
    length = math.sqrt(sum(x * x for x in a))
    return tuple(x / max(length, 1.e-10) for x in a)


def multiply(a, b):
    return [sum(a[k * 4 + row] * b[column * 4 + k] for k in range(4))
            for column in range(4) for row in range(4)]


def look_at(eye, target):
    z = normalize(subtract(eye, target))
    x = normalize((z[2], 0, -z[0]))
    y = cross(z, x)
    dot = lambda a, b: sum(v * w for v, w in zip(a, b))
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
            -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]


def light_projection(extent=260, depth_range=2200):
    sun = normalize((-.62, .78, .28))
    center = (0, 0, -210)
    distance = max(1050, (depth_range - 100) / 2)
    eye = tuple(center[i] + sun[i] * distance for i in range(3))
    ortho = [1 / extent, 0, 0, 0, 0, 1 / extent, 0, 0, 0, 0, -2 / depth_range, 0,
             0, 0, -(depth_range + 2) / depth_range, 1]
    return multiply(ortho, look_at(eye, center))


def perspective(width, height):
    f = 1 / math.tan(.37)
    return [f * height / width, 0, 0, 0, 0, f, 0, 0, 0, 0, -4002 / 3998, -1,
            0, 0, -16000 / 3998, 0]


def geometry():
    vertices = []

    def triangle(a, b, c, color, kind, normal=None, normals=None):
        normal = normal or normalize(cross(subtract(b, a), subtract(c, a)))
        for p, n in zip((a, b, c), normals or (normal, normal, normal)):
            vertices.extend((*p, *n, *color, kind))

    def sphere(center, radius, color, kind, sectors=12, rings=7, seed=0, smooth=True, warped=False):
        def point(y, x):
            latitude = -math.pi / 2 + y / rings * math.pi
            angle = x / sectors * math.tau
            unit = (math.cos(latitude) * math.cos(angle), math.sin(latitude), math.cos(latitude) * math.sin(angle))
            warp = 1 + .10 * math.sin(unit[0] * 5.8 + seed) + .075 * math.cos(unit[2] * 6.4 - unit[1] * 4 + seed * 1.7) if warped else 1
            return tuple(center[k] + radius[k] * unit[k] * warp for k in range(3))

        def face(a, b, c):
            flat = normalize(cross(subtract(b, a), subtract(c, a)))
            normals = None
            if smooth:
                normals = []
                for p in (a, b, c):
                    ellipsoid = normalize(tuple((p[k] - center[k]) / (radius[k] * radius[k]) for k in range(3)))
                    normals.append(normalize(tuple(ellipsoid[k] * .75 + flat[k] * .25 for k in range(3))))
            triangle(a, b, c, color, kind, normal=flat, normals=normals)

        for y in range(rings):
            for x in range(sectors):
                a, b, c, d = point(y, x), point(y, x + 1), point(y + 1, x + 1), point(y + 1, x)
                # This winding points out of the convex ellipsoid.
                if y:
                    face(a, c, b)
                if y + 1 < rings:
                    face(a, d, c)

    # Ground has a long open strip. The isolated convex crown cannot occlude
    # itself; the cluster has intentionally narrow contacts and depth steps.
    ground = ((-180, -44, -75), (180, -44, -75), (180, -44, -550), (-180, -44, -550))
    triangle(ground[0], ground[2], ground[1], (.51, .59, .36), 1, (0, 1, 0))
    triangle(ground[0], ground[3], ground[2], (.51, .59, .36), 1, (0, 1, 0))
    sphere((-95, 18, -210), (27, 30, 26), (.34, .59, .25), 2)
    crowns = [
        ((-31, -1, -171), (32, 29, 27)),
        ((18, -4, -175), (34, 31, 26)),
        ((61, 2, -190), (31, 32, 29)),
        ((-17, 41, -192), (32, 29, 28)),
        ((27, 40, -196), (34, 31, 27)),
        ((67, 42, -219), (30, 26, 30)),
        ((7, 71, -230), (31, 29, 28)),
    ]
    for index, (center, radius) in enumerate(crowns):
        green = (.27 + index * .009, .49 + index * .014, .20 + index * .005)
        # Match ModelBuilder.blob: warped low-poly geometry with a .75 smooth /
        # .25 face normal blend. Smooth shading over a faceted depth buffer is
        # the hard case that a flat-normal sphere does not exercise.
        sphere(center, radius, green, index + 3, seed=index * 1.3 + 4.8, warped=True)
    return vertices


class LightingTest(ShaderTest):
    def __init__(self, context):
        super().__init__(context)
        signatures = {
            'GenFramebuffers': (None, C.c_int, C.POINTER(C.c_uint)),
            'BindFramebuffer': (None, C.c_uint, C.c_uint),
            'FramebufferTexture2D': (None, C.c_uint, C.c_uint, C.c_uint, C.c_uint, C.c_int),
            'CheckFramebufferStatus': (C.c_uint, C.c_uint),
            'DrawBuffers': (None, C.c_int, C.POINTER(C.c_uint)),
            'ReadBuffer': (None, C.c_uint),
            'ClearColor': (None, C.c_float, C.c_float, C.c_float, C.c_float),
            'Clear': (None, C.c_uint),
            'ClearBufferfv': (None, C.c_uint, C.c_int, C.POINTER(C.c_float)),
            'Enable': (None, C.c_uint),
            'DepthFunc': (None, C.c_uint),
            'Uniform3f': (None, C.c_int, C.c_float, C.c_float, C.c_float),
            'Uniform4f': (None, C.c_int, C.c_float, C.c_float, C.c_float, C.c_float),
            'UniformMatrix4fv': (None, C.c_int, C.c_int, C.c_ubyte, C.POINTER(C.c_float)),
        }
        for name, signature in signatures.items():
            setattr(self, name, EGL.function(self.gl, 'gl' + name, *signature))
        self.quad = self.buffer([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])

    def buffer(self, values):
        data = (C.c_float * len(values))(*values)
        buffer = C.c_uint()
        self.GenBuffers(1, C.byref(buffer))
        self.BindBuffer(0x8892, buffer)
        self.BufferData(0x8892, C.sizeof(data), data, 0x88E4)
        return buffer

    def bind_texture(self, unit, texture):
        self.ActiveTexture(0x84C0 + unit)
        self.BindTexture(0x0DE1, texture)

    def target(self, width, height, count=1, depth=False):
        framebuffer = C.c_uint()
        self.GenFramebuffers(1, C.byref(framebuffer))
        self.BindFramebuffer(0x8D40, framebuffer)
        textures = []
        for i in range(count):
            texture = C.c_uint()
            self.GenTextures(1, C.byref(texture))
            self.bind_texture(7, texture)
            for key in (0x2801, 0x2800):
                self.TexParameteri(0x0DE1, key, 0x2600)
            for key in (0x2802, 0x2803):
                self.TexParameteri(0x0DE1, key, 0x812F)
            # Render targets are fully written or cleared. Allocating them
            # without a Python zero buffer avoids large temporary CPU copies.
            self.TexImage2D(0x0DE1, 0, 0x8058, width, height, 0, 0x1908, 0x1401, None)
            self.FramebufferTexture2D(0x8D40, 0x8CE0 + i, 0x0DE1, texture, 0)
            textures.append(texture)
        if depth:
            texture = C.c_uint()
            self.GenTextures(1, C.byref(texture))
            self.bind_texture(7, texture)
            for key in (0x2801, 0x2800):
                self.TexParameteri(0x0DE1, key, 0x2600)
            for key in (0x2802, 0x2803):
                self.TexParameteri(0x0DE1, key, 0x812F)
            self.TexImage2D(0x0DE1, 0, 0x81A6, width, height, 0, 0x1902, 0x1405, None)
            self.FramebufferTexture2D(0x8D40, 0x8D00, 0x0DE1, texture, 0)
            textures.append(texture)
        attachments = (C.c_uint * count)(*[0x8CE0 + i for i in range(count)])
        self.DrawBuffers(count, attachments)
        status = self.CheckFramebufferStatus(0x8D40)
        if status != 0x8CD5:
            raise RuntimeError(f'Framebuffer incompleto: 0x{status:04x}')
        return framebuffer, textures

    def pixels(self, width, height, attachment=0):
        self.ReadBuffer(0x8CE0 + attachment)
        data = C.create_string_buffer(width * height * 4)
        self.ReadPixels(0, 0, width, height, 0x1908, 0x1401, data)
        self.Finish()
        error = self.GetError()
        if error:
            raise RuntimeError(f'Erro OpenGL 0x{error:04x}')
        return data.raw

    def fixture(self, width, height):
        target, textures = self.target(width, height, 3, depth=True)
        self.Viewport(0, 0, width, height)
        for attachment, clear in enumerate(((.66, .715, .64, 1), (.5, .5, .65, 0), (0, 1, 1, 0))):
            self.ClearBufferfv(0x1800, attachment, (C.c_float * 4)(*clear))
        self.Clear(0x0100)
        self.Enable(0x0B71)
        self.DepthFunc(0x0201)
        self.Disable(0x0B44)
        self.Disable(0x0BE2)
        program = self.program((FIXTURE_VERTEX, FIXTURE_FRAGMENT), 'fixture-geometria')
        self.UseProgram(program)
        self.Uniform2f(self.GetUniformLocation(program, b'u_projection'), math.tan(.37) * width / height, math.tan(.37))
        vertices = geometry()
        self.BindBuffer(0x8892, self.buffer(vertices))
        stride = 10 * 4
        for name, size, offset in (('position', 3, 0), ('normal', 3, 3), ('color', 3, 6), ('kind', 1, 9)):
            attribute = self.GetAttribLocation(program, ('a_' + name).encode())
            self.EnableVertexAttribArray(attribute)
            self.VertexAttribPointer(attribute, size, 0x1406, 0, stride, C.c_void_p(offset * 4))
        self.DrawArrays(4, 0, len(vertices) // 10)
        images = [self.pixels(width, height, i) for i in range(3)]
        self.DeleteProgram(program)
        return textures, images

    def fullscreen(self, program, target, scene_size, ao_size, radius, strength, slices, steps, has_surface=1, enabled=1, draw_size=None):
        width, height = scene_size
        self.BindFramebuffer(0x8D40, target)
        self.UseProgram(program)
        location = lambda name: self.GetUniformLocation(program, ('u_' + name).encode())
        for name, unit in {'color': 0, 'sceneDepth': 1, 'surface': 2, 'ao': 3}.items():
            self.Uniform1i(location(name), unit)
        for name, value in {'aaKind': 0, 'hasSurface': has_surface, 'aoRadius': radius,
                            'aoStrength': strength, 'aoSlices': slices, 'aoSteps': steps,
                            'aoEnabled': enabled}.items():
            self.Uniform1f(location(name), value)
        for name, value in {'resolution': scene_size, 'activeScale': (1, 1),
                            'projection': (math.tan(.37) * width / height, math.tan(.37)),
                            'projectionJitter': (0, 0), 'aoViewport': ao_size, 'aoResource': ao_size}.items():
            self.Uniform2f(location(name), *value)
        rotation = getattr(self, 'view_rotation', (1, 0, 0, 0, 1, 0, 0, 0, 1))
        self.UniformMatrix3fv(location('viewRotation'), 1, 0, (C.c_float * 9)(*rotation))
        self.BindBuffer(0x8892, self.quad)
        attribute = self.GetAttribLocation(program, b'a_position')
        self.EnableVertexAttribArray(attribute)
        self.VertexAttribPointer(attribute, 2, 0x1406, 0, 0, None)
        for capability in (0x0B71, 0x0BE2, 0x0BD0, 0x0B44):
            self.Disable(capability)
        self.Viewport(0, 0, *(draw_size or scene_size))
        self.DrawArrays(4, 0, 6)

    def pipeline(self, programs, textures, scene_size, ao_size, quality, has_surface):
        width, height = scene_size
        horizon, raw_textures = self.target(*ao_size)
        denoise, denoised_textures = self.target(*ao_size)
        composed, final_textures = self.target(*scene_size)
        self.bind_texture(1, textures[3])
        self.bind_texture(2, textures[1])
        self.bind_texture(0, textures[0])
        # A reduced AO target uses a reduced viewport; scene reconstruction
        # continues to use the original projection and depth texture size.
        self.fullscreen(programs['horizon'], horizon, scene_size, ao_size, *quality, has_surface, draw_size=ao_size)
        raw = self.pixels(*ao_size)
        self.bind_texture(0, raw_textures[0])
        self.fullscreen(programs['denoise'], denoise, scene_size, ao_size, *quality, has_surface, draw_size=ao_size)
        filtered = self.pixels(*ao_size)
        self.bind_texture(0, textures[0])
        self.bind_texture(3, denoised_textures[0])
        self.fullscreen(programs['composition'], composed, scene_size, ao_size, *quality, has_surface)
        final = self.pixels(width, height)
        self.fullscreen(programs['composition'], composed, scene_size, ao_size, *quality, has_surface, enabled=0)
        disabled = self.pixels(width, height)
        return raw, filtered, final, disabled

    def scene_uniforms(self, program, size, light, shadow_size, quality, enabled, render_pass=0, depth_range=2200):
        self.UseProgram(program)
        location = lambda name: self.GetUniformLocation(program, ('u_' + name).encode())
        identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        for name, matrix in {'viewProjection': light if render_pass else perspective(*size),
                             'lightViewProjection': light, 'bodyRotation': identity}.items():
            self.UniformMatrix4fv(location(name), 1, 0, (C.c_float * 16)(*matrix))
        for name, value in {'origin': (0, 0, 0), 'scale': (1, 1, 1), 'pivot': (0, 0, 0),
                            'tint': (1, 1, 1), 'hole': (100000, 100000, 0), 'eye': (0, 0, 0),
                            'apertureSin': (0, 0, 0), 'apertureCos': (1, 1, 1)}.items():
            self.Uniform3f(location(name), *value)
        for name, value in {'rotation': 0, 'material': 14, 'depth': 40, 'travel': 0,
                            'pixelScale': 2 * math.tan(.37) / size[1], 'reactive': 0,
                            'renderPass': render_pass, 'shadowEnabled': enabled,
                            'shadowTexel': 1 / shadow_size, 'staticShadowTexel': 1 / shadow_size,
                            'shadowWorldTexel': 520 / shadow_size, 'staticShadowWorldTexel': 520 / shadow_size,
                            'shadowQuality': quality[0], 'shadowSoftness': quality[1],
                            'shadowDepthRange': depth_range}.items():
            self.Uniform1f(location(name), value)
        self.Uniform4f(location('liveShadowWindow'), 0, 0, 1, 1)
        for name, unit in {'staticShadowMap': 2, 'shadowMap': 3, 'turfMap': 4}.items():
            self.Uniform1i(location(name), unit)

    def scene_vertices(self, program):
        vertices = geometry()
        # Model material 14 stores foliage finish 3 in the high bits of blue.
        for offset in range(0, len(vertices), 10):
            if vertices[offset + 9] > 1:
                vertices[offset + 8] += 6
        self.BindBuffer(0x8892, self.buffer(vertices))
        for name, offset in (('position', 0), ('normal', 3), ('color', 6)):
            attribute = self.GetAttribLocation(program, ('a_' + name).encode())
            self.EnableVertexAttribArray(attribute)
            self.VertexAttribPointer(attribute, 3, 0x1406, 0, 40, C.c_void_p(offset * 4))
        return len(vertices) // 10

    def shadows(self, program, scene_size, shadow_size, quality, depth_range=2200):
        light = light_projection(depth_range=depth_range)
        shadow_target, shadow_textures = self.target(shadow_size, shadow_size, depth=True)
        self.Viewport(0, 0, shadow_size, shadow_size)
        self.ClearColor(1, 1, 1, 1)
        self.Clear(0x4100)
        self.Enable(0x0B71)
        self.DepthFunc(0x0201)
        for capability in (0x0BE2, 0x0BD0, 0x0B44):
            self.Disable(capability)
        self.scene_uniforms(program, scene_size, light, shadow_size, quality, 0, render_pass=2, depth_range=depth_range)
        count = self.scene_vertices(program)
        # Keep both maps unbound while writing the depth-color attachment.
        self.bind_texture(2, 0)
        self.bind_texture(3, 0)
        self.DrawArrays(4, 0, count)
        shadow_image = self.pixels(shadow_size, shadow_size) if shadow_size == 1024 else None
        self.bind_texture(2, shadow_textures[0])
        self.texture(3, 1, 1, bytes((255, 255, 255, 255)))
        self.texture(4, 1, 1, bytes((255, 255, 255, 255)))
        target, final_textures = self.target(*scene_size, depth=True)
        images = []
        for enabled in (0, 1):
            self.BindFramebuffer(0x8D40, target)
            self.Viewport(0, 0, *scene_size)
            self.ClearColor(.66, .715, .64, 1)
            self.Clear(0x4100)
            self.Enable(0x0B71)
            self.scene_uniforms(program, scene_size, light, shadow_size, quality, enabled, depth_range=depth_range)
            self.DrawArrays(4, 0, count)
            images.append(self.pixels(*scene_size))
        return images[0], images[1], shadow_image


def percentile(values, fraction):
    if not values:
        return None
    return sorted(values)[round((len(values) - 1) * fraction)]


def metrics(base, final, metadata, width, height):
    # A two-pass chamfer distance transform keeps the open-ground mask away
    # from every actual canopy silhouette, irrespective of screen coordinates.
    kinds = [metadata[i] for i in range(0, len(metadata), 4)]
    distance = [0 if kind > 1 else width + height for kind in kinds]
    for y in range(height):
        for x in range(width):
            i = y * width + x
            if x:
                distance[i] = min(distance[i], distance[i - 1] + 1)
            if y:
                distance[i] = min(distance[i], distance[i - width] + 1)
    for y in range(height - 1, -1, -1):
        for x in range(width - 1, -1, -1):
            i = y * width + x
            if x + 1 < width:
                distance[i] = min(distance[i], distance[i + 1] + 1)
            if y + 1 < height:
                distance[i] = min(distance[i], distance[i + width] + 1)
    regions = {'openGround': [], 'isolatedConvexCrown': [], 'overlappingCrowns': [], 'contactGround': []}
    sky_errors, silhouette_sky_errors = [], []
    for i, kind in enumerate(kinds):
        offset = i * 4
        error = max(abs(final[offset + c] - base[offset + c]) for c in range(3))
        if kind == 0:
            sky_errors.append(error)
            if distance[i] <= 4:
                silhouette_sky_errors.append(error)
            continue
        original = sum(base[offset + c] * weight for c, weight in enumerate((.299, .587, .114)))
        result = sum(final[offset + c] * weight for c, weight in enumerate((.299, .587, .114)))
        # This estimates the composed surface visibility, accounting for the
        # fixture's known .65 ambient fraction and its RGBA8 quantization.
        visibility = 1 - (original - result) / max(original * .65, 1)
        if kind == 1:
            if distance[i] > 45:
                regions['openGround'].append(visibility)
            elif distance[i] < 8:
                regions['contactGround'].append(visibility)
        elif kind == 2:
            regions['isolatedConvexCrown'].append(visibility)
        else:
            regions['overlappingCrowns'].append(visibility)
    report = {}
    for name, values in regions.items():
        report[name] = {'pixels': len(values), 'meanVisibility': sum(values) / len(values) if values else None,
                        'minimumVisibility': min(values) if values else None,
                        'p01Visibility': percentile(values, .01), 'p10Visibility': percentile(values, .1),
                        'fractionBelowHalf': sum(value < .5 for value in values) / len(values) if values else None,
                        'fractionBelowQuarter': sum(value < .25 for value in values) / len(values) if values else None,
                        'fractionOccluded': sum(value < .97 for value in values) / len(values) if values else None}
    report['sky'] = {'pixels': len(sky_errors), 'maxColorError': max(sky_errors, default=0),
                     'silhouettePixels': len(silhouette_sky_errors), 'maxSilhouetteColorError': max(silhouette_sky_errors, default=0)}
    return report


def shadow_metrics(base, final, metadata, normals):
    sun = normalize((-.62, .78, .28))
    convex, ground, canopy = [], [], []
    for offset in range(0, len(metadata), 4):
        kind = metadata[offset]
        if not kind:
            continue
        original = sum(base[offset + c] * weight for c, weight in enumerate((.299, .587, .114)))
        result = sum(final[offset + c] * weight for c, weight in enumerate((.299, .587, .114)))
        attenuation = max(0, (original - result) / max(original, 1))
        if kind == 1:
            ground.append(attenuation)
        elif kind >= 3:
            canopy.append(attenuation)
        else:
            x, y = (normals[offset + c] / 255 * 2 - 1 for c in range(2))
            z = 1 - abs(x) - abs(y)
            correction = max(0, -z)
            n = normalize((x + (-correction if x >= 0 else correction),
                           y + (-correction if y >= 0 else correction), z))
            # A convex crown's light-facing side has no physical self-shadow.
            # Back faces can have real occlusion and transmitted leaf sunlight.
            if sum(a * b for a, b in zip(n, sun)) > .25:
                convex.append(attenuation)
    report = {}
    for name, values in (('isolatedSunFacingCrown', convex), ('ground', ground), ('overlappingCrowns', canopy)):
        report[name] = {'pixels': len(values), 'meanAttenuation': sum(values) / max(1, len(values)),
                        'p95Attenuation': percentile(values, .95), 'maxAttenuation': max(values, default=0),
                        'fractionAboveFivePercent': sum(value > .05 for value in values) / max(1, len(values)),
                        'fractionAboveTwentyPercent': sum(value > .2 for value in values) / max(1, len(values))}
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--angle-dir', required=True)
    parser.add_argument('--record-only', action='store_true', help='Gera imagens e métricas sem asserções de qualidade.')
    args = parser.parse_args()
    result_dir = ROOT / 'tests' / 'resultados'
    sources = json.loads((result_dir / 'gpu-fontes.json').read_text())
    width, height = 720, 420
    context = EGL(args.angle_dir, width, height)
    api = LightingTest(context)
    textures, fixture_images = api.fixture(width, height)
    base, normals, metadata = fixture_images
    write_png(result_dir / 'iluminacao-cena-sem-ao.png', width, height, base)
    write_png(result_dir / 'iluminacao-normais.png', width, height, normals)
    report = {'renderer': context.renderer, 'version': context.version,
              'scope': 'Geometria facetada rasterizada e AO real em OpenGL ES offscreen; sem navegador, saves ou medição de FPS.',
              'fixtures': {}, 'shadows': {}, 'failures': []}
    # Use identical radius/strength/sample settings before and after. Surface-buffer and
    # reconstructed-normal paths are both material compatibility contracts.
    for version in ('before', 'after'):
        programs = {name: api.program(sources[version][name]['es300'], version + '/' + name)
                    for name in ('horizon', 'denoise', 'composition')}
        for has_surface in (1, 0):
            for scale in (1, .5):
                ao_size = (round(width * scale), round(height * scale))
                quality = (10.5, .85, 4, 6)
                raw, filtered, final, disabled = api.pipeline(programs, textures, (width, height), ao_size, quality, has_surface)
                label = f'{version}-{"normais" if has_surface else "profundidade"}-{int(scale * 100)}'
                measured = metrics(base, final, metadata, width, height)
                measured['disabledMaxError'] = max(abs(a - b) for a, b in zip(base, disabled))
                measured['settings'] = {'aoRadius': quality[0], 'aoStrength': quality[1], 'slices': quality[2],
                                        'steps': quality[3], 'surfaceBuffer': bool(has_surface), 'scale': scale}
                report['fixtures'][label] = measured
                write_png(result_dir / f'iluminacao-{label}.png', width, height, final)
                grayscale = bytes(component for i in range(0, len(filtered), 4)
                                  for component in (filtered[i], filtered[i], filtered[i], 255))
                write_png(result_dir / f'iluminacao-ao-{label}.png', *ao_size, grayscale)
                if version == 'after':
                    checks = {
                        'AO desligado alterou a imagem': measured['disabledMaxError'] <= 1,
                        'AO manchou o chão aberto': measured['openGround']['p01Visibility'] >= .94,
                        'AO criou pontos escuros na copa convexa sem contato': measured['isolatedConvexCrown']['minimumVisibility'] >= .90,
                        'AO criou gaps quase pretos nas copas': measured['overlappingCrowns']['fractionBelowQuarter'] < .005,
                        'AO esmagou contato em preto': measured['overlappingCrowns']['minimumVisibility'] >= .55,
                        'AO perdeu toda a oclusão nos contatos': measured['overlappingCrowns']['fractionOccluded'] > .004,
                        'AO vazou sobre o céu no contorno': measured['sky']['maxSilhouetteColorError'] <= 1,
                    }
                    report['failures'].extend(label + ': ' + reason for reason, ok in checks.items() if not ok)
        for program in programs.values():
            api.DeleteProgram(program)
        scene = api.program(sources[version]['scene']['es300'], version + '/scene-shadow')
        shadow_cases = [(512, (0, .25)), (1024, (1, .65)), (2048, (2, 1))]
        if version == 'after':
            # Ultra's fixed map is 4096 on desktop. Exercise its real GPU
            # allocation and rendering without producing a 4096-square PNG.
            shadow_cases.append((4096, (2, 1)))
        for shadow_size, quality in shadow_cases:
            unshadowed, shadowed, shadow_map = api.shadows(scene, (width, height), shadow_size, quality)
            label = f'{version}-{shadow_size}-quality{quality[0]}'
            measured = shadow_metrics(unshadowed, shadowed, metadata, normals)
            measured['settings'] = {'mapSize': shadow_size, 'filterQuality': quality[0], 'softness': quality[1]}
            report['shadows'][label] = measured
            write_png(result_dir / f'iluminacao-sombras-{label}.png', width, height, shadowed)
            if shadow_size == 1024:
                write_png(result_dir / f'iluminacao-sombras-sem-{version}.png', width, height, unshadowed)
                write_png(result_dir / f'iluminacao-mapa-sombras-{version}.png', shadow_size, shadow_size, shadow_map)
            if version == 'after':
                checks = {
                    'Sombra manchou copa convexa voltada ao sol': measured['isolatedSunFacingCrown']['fractionAboveFivePercent'] < .01,
                    'Sombra projetada desapareceu do chão': measured['ground']['fractionAboveTwentyPercent'] > .02,
                }
                report['failures'].extend(label + ': ' + reason for reason, ok in checks.items() if not ok)
        if version == 'after':
            original_uniforms = api.scene_uniforms
            shadow_distance = 0
            def distance_uniforms(program, *parameters, **options):
                original_uniforms(program, *parameters, **options)
                api.Uniform1f(api.GetUniformLocation(program, b'u_shadowDistance'), shadow_distance)
                api.Uniform2f(api.GetUniformLocation(program, b'u_shadowCenter'), 0, -210)
            api.scene_uniforms = distance_uniforms
            results = []
            for shadow_distance in (0, 80):
                base_image, shaded_image, _ = api.shadows(scene, (width, height), 512, (1, .65))
                results.append((base_image, shaded_image))
            outside_error = inside_error = outside_suppressed = inside_shadow = 0
            tangent = math.tan(.37)
            for y in range(height):
                for x in range(width):
                    offset = (y * width + x) * 4
                    if metadata[offset] == 0:
                        continue
                    depth = (metadata[offset + 1] * 256 + metadata[offset + 2]) / 65535 * 4000
                    world_x = ((x + .5) / width * 2 - 1) * tangent * width / height * depth
                    radius = math.hypot(world_x, -depth + 210)
                    for channel in range(3):
                        baseline = results[0][1][offset + channel]
                        limited = results[1][1][offset + channel]
                        open_value = results[1][0][offset + channel]
                        if radius > 82:
                            outside_error = max(outside_error, abs(limited - open_value))
                            outside_suppressed += abs(baseline - open_value) > 8
                        elif radius < 60:
                            inside_error = max(inside_error, abs(limited - baseline))
                            inside_shadow += abs(baseline - open_value) > 8
            report['shadowDistance'] = {'outsideMaxError': outside_error, 'insideMaxError': inside_error,
                                        'suppressedChannels': outside_suppressed, 'retainedChannels': inside_shadow}
            if outside_error > 2 or inside_error > 2 or outside_suppressed < 100 or inside_shadow < 100:
                report['failures'].append('Distância de sombra não preservou o centro ou não eliminou a sombra fora do alcance.')
            api.scene_uniforms = original_uniforms
            # Wide maps require a longer depth interval. Bias and receiver-plane
            # limits must still represent the same world-space distances.
            api.Uniform1f(api.GetUniformLocation(scene, b'u_shadowDistance'), 0)
            base_image, shaded_image, _ = api.shadows(scene, (width, height), 512, (1, .65), depth_range=4100)
            measured = shadow_metrics(base_image, shaded_image, metadata, normals)
            report['shadowDepthRange'] = measured
            if (measured['isolatedSunFacingCrown']['fractionAboveFivePercent'] >= .01 or
                    measured['ground']['fractionAboveTwentyPercent'] <= .02):
                report['failures'].append('A projeção de sombras ampliada perdeu contatos ou criou manchas nas copas.')
        api.DeleteProgram(scene)
    context.close()
    (result_dir / 'iluminacao-gpu.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    compact = {key: {'openGroundP01': measured['openGround']['p01Visibility'],
                     'isolatedCrownMinimum': measured['isolatedConvexCrown']['minimumVisibility'],
                     'overlappingCrownMinimum': measured['overlappingCrowns']['minimumVisibility'],
                     'darkGapFraction': measured['overlappingCrowns']['fractionBelowQuarter'],
                     'contactFraction': measured['overlappingCrowns']['fractionOccluded'],
                     'skyContourMaxError': measured['sky']['maxSilhouetteColorError']}
               for key, measured in report['fixtures'].items()}
    compact_shadows = {key: {'falseShadowFraction': measured['isolatedSunFacingCrown']['fractionAboveFivePercent'],
                             'groundShadowFraction': measured['ground']['fractionAboveTwentyPercent']}
                       for key, measured in report['shadows'].items()}
    print(json.dumps({'renderer': report['renderer'], 'fixtures': compact, 'shadows': compact_shadows, 'failures': report['failures']}, indent=2))
    if report['failures'] and not args.record_only:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
