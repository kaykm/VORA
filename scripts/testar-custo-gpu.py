"""Native GLES GPU timers: generic/specialized/depth-primed opaque rendering.

Production meshes and shaders, identical resolution/instances/light/material.
No browser, real saves, third-party modules or CPU frame-time proxy.
"""
import argparse
import base64
import ctypes as C
import importlib.util
import json
import math
import statistics
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('vora_instances', ROOT / 'scripts' / 'testar-instancias.py')
INSTANCES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(INSTANCES)
LIGHTING = INSTANCES.LIGHTING


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--angle-dir', required=True)
    args = parser.parse_args()
    directory = ROOT / 'tests' / 'resultados'
    source = json.loads((directory / 'instancias-gpu-fontes.json').read_text(encoding='utf-8'))
    width, height = 1280, 720
    context = LIGHTING.EGL(args.angle_dir, width, height)
    api = INSTANCES.InstanceTest(context)
    fn = lambda name, result, *params: LIGHTING.EGL.function(api.gl, 'gl' + name, result, *params)
    color_mask = fn('ColorMask', None, C.c_ubyte, C.c_ubyte, C.c_ubyte, C.c_ubyte)
    gen_vaos = fn('GenVertexArrays', None, C.c_int, C.POINTER(C.c_uint))
    bind_vao = fn('BindVertexArray', None, C.c_uint)
    gen_queries = fn('GenQueries', None, C.c_int, C.POINTER(C.c_uint))
    begin_query = fn('BeginQuery', None, C.c_uint, C.c_uint)
    end_query = fn('EndQuery', None, C.c_uint)
    query_result = fn('GetQueryObjectui64vEXT', None, C.c_uint, C.c_uint, C.POINTER(C.c_uint64))
    delete_queries = fn('DeleteQueries', None, C.c_int, C.POINTER(C.c_uint))
    get_integer = fn('GetIntegerv', None, C.c_uint, C.POINTER(C.c_int))
    api.framebuffer, _ = api.target(width, height, 2, depth=True)
    programs = {}
    for name, pair in [('generic', source['program']), ('opaque', source['opaque']), ('depth', source['depth'])]:
        print('Compilando ' + name, flush=True)
        programs[name] = api.program(pair, 'gpu-cost-' + name)
    eye, target = [215, 280, 355], [0, 34, 0]
    f, near, far = 1 / math.tan(.37), 2., 4000.
    projection = [f / (width / height), 0, 0, 0, 0, f, 0, 0, 0, 0,
                  (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]
    vp = LIGHTING.multiply(projection, LIGHTING.look_at(eye, target))
    identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
    uniforms = {'bodyRotation': identity, 'pivot': [0, 0, 0], 'viewProjection': vp,
                'lightViewProjection': LIGHTING.light_projection(500), 'renderPass': 0,
                'shadowEnabled': 1, 'shadowQuality': 2, 'shadowSoftness': 1, 'shadowDepthRange': 2200,
                'shadowDistance': 760, 'shadowCenter': [0, 0], 'liveShadowWindow': [0, 0, 1, 1],
                'shadowTexel': 1 / 256, 'staticShadowTexel': 1 / 256,
                'shadowWorldTexel': 2, 'staticShadowWorldTexel': 4,
                'material': 14, 'tint': [1, 1, 1], 'reactive': 0, 'eye': eye,
                'hole': [100000, 100000, 0], 'depth': 0, 'travel': 0,
                'pixelScale': 2 * math.tan(.37) / height, 'instanced': 1}
    for program in programs.values():
        api.UseProgram(program)
        for name, value in uniforms.items():
            api.set_uniform(program, name, value)
        for name, unit in {'staticShadowMap': 2, 'shadowMap': 3, 'turfMap': 4}.items():
            api.Uniform1i(api.GetUniformLocation(program, ('u_' + name).encode()), unit)
    for unit in [2, 3]:
        texels = []
        for y in range(256):
            for x in range(256):
                depth = .43 if (x // 29 + y // 31) % 2 else .57
                parts = [(depth * scale) % 1 for scale in [1, 255, 65025]]
                parts[0] -= parts[1] / 255
                parts[1] -= parts[2] / 255
                texels.extend([round(v * 255) for v in parts] + [255])
        api.texture(unit, 256, 256, texels)
    api.texture(4, 1, 1, [255, 255, 255, 255])
    report = {'renderer': context.renderer, 'version': context.version, 'resolution': [width, height],
              'method': 'EXT_disjoint_timer_query; 9 alternating GPU samples per mode after warmup; medians. Same mesh, instances, textures and lights.',
              'browserFPS': None, 'temperature': None, 'cases': []}
    for name, total, spacing in [('arvore-densa', 96, 27), ('arvore-esparsa', 12, 76), ('banco', 64, 34)]:
        vertices = base64.b64decode(source['meshes']['arvore' if name.startswith('arvore') else 'banco'])
        columns = 12 if total == 96 else 4 if total == 12 else 8
        rows = total // columns
        records = [[(i % columns - (columns - 1) / 2) * spacing, 0, (i // columns - (rows - 1) / 2) * spacing,
                    .65 + i % 4 * .18, .8 + i % 3 * .13, .7 + i % 5 * .09, i * .371] for i in range(total)]
        packed = struct.pack('<' + 'f' * (len(records) * 7), *(v for record in records for v in record))
        vertex_buffer, instance_buffer = api.raw_buffer(vertices), api.raw_buffer(packed)
        vaos = {}
        for kind, program in programs.items():
            vao = C.c_uint()
            gen_vaos(1, C.byref(vao))
            bind_vao(vao)
            api.BindBuffer(0x8892, vertex_buffer)
            for attribute, offset in [('position', 0), ('normal', 12), ('color', 24)]:
                location = api.GetAttribLocation(program, ('a_' + attribute).encode())
                if location >= 0:
                    api.EnableVertexAttribArray(location)
                    api.VertexAttribPointer(location, 3, 0x1406, 0, 36, C.c_void_p(offset))
            api.BindBuffer(0x8892, instance_buffer)
            for attribute, size, offset in [('instanceOrigin', 3, 0), ('instanceScale', 3, 12), ('instanceRotation', 1, 24)]:
                location = api.GetAttribLocation(program, ('a_' + attribute).encode())
                api.EnableVertexAttribArray(location)
                api.VertexAttribPointer(location, size, 0x1406, 0, 28, C.c_void_p(offset))
                api.Divisor(location, 1)
            vaos[kind] = vao

        def draw(kind):
            api.UseProgram(programs[kind])
            bind_vao(vaos[kind])
            api.DrawInstances(4, 0, len(vertices) // 36, total)

        def frame(mode):
            api.BindFramebuffer(0x8D40, api.framebuffer)
            api.Viewport(0, 0, width, height)
            api.Enable(0x0B71)
            api.Disable(0x0B44)
            api.Disable(0x0BE2)
            api.Disable(0x0BD0)
            api.DepthMask(1)
            api.DepthFunc(0x0203)
            color_mask(1, 1, 1, 1)
            api.ClearColor(.06, .10, .08, 1)
            api.Clear(0x4100)
            if mode == 'prepass':
                color_mask(0, 0, 0, 0)
                draw('depth')
                color_mask(1, 1, 1, 1)
                api.DepthFunc(0x0202)
                api.DepthMask(0)
                draw('opaque')
            else:
                draw(mode)

        images, surfaces = {}, {}
        for mode in ['generic', 'opaque', 'prepass']:
            for _ in range(4):
                frame(mode)
            images[mode] = api.pixels(width, height)
            surfaces[mode] = api.pixels(width, height, 1)
            LIGHTING.write_png(directory / f'gpu-custo-{name}-{mode}.png', width, height, images[mode])
        differences = {mode: sum(a != b for a, b in zip(images['generic'], image)) for mode, image in images.items()}
        surface_differences = {mode: sum(a != b for a, b in zip(surfaces['generic'], image)) for mode, image in surfaces.items()}
        if any(differences.values()) or any(surface_differences.values()):
            raise AssertionError('Pixels/superfícies divergiram: ' + str((differences, surface_differences)))
        samples = {mode: [] for mode in images}
        for sample in range(9):
            modes = list(images)
            if sample % 2:
                modes.reverse()
            for mode in modes:
                query = C.c_uint()
                gen_queries(1, C.byref(query))
                begin_query(0x88BF, query)
                for _ in range(3):
                    frame(mode)
                end_query(0x88BF)
                api.Finish()
                value = C.c_uint64()
                query_result(query, 0x8866, C.byref(value))
                disjoint = C.c_int()
                get_integer(0x8FBB, C.byref(disjoint))
                delete_queries(1, C.byref(query))
                if not disjoint.value:
                    samples[mode].append(value.value / 1e6 / 3)
        error = api.GetError()
        if error:
            raise AssertionError(f'GLES error 0x{error:04x}')
        entry = {'scene': name, 'instances': total, 'trianglesPerColorPass': total * len(vertices) // 108,
                 'differentChannels': differences, 'differentSurfaceChannels': surface_differences,
                 'gpuMs': {mode: statistics.median(v) for mode, v in samples.items()},
                 'samples': samples}
        report['cases'].append(entry)
        print(json.dumps({key: value for key, value in entry.items() if key != 'samples'}), flush=True)
    context.close()
    (directory / 'gpu-custo.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
