"""Native GLES: conservative shadow bounds, exact pixels and elapsed GPU time.

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


def verify_filter(api, source, gen_vaos, bind_vao):
    """Compare both production PCF paths inside the same shader invocation.

    Sparse single-texel blockers, tagged plants, slopes and atlas edges must
    never produce a shortcut that changes visibility by more than 2e-6.
    """
    width, height, size = 192, 128, 64
    framebuffer, _ = api.target(width, height)
    bounds_fbo, bounds_textures = api.target(size // 4, size // 4)
    reduce_program = api.program(source['reduce'], 'bounds-contract-reduction')
    probe = api.program(source['probe'], 'bounds-contract-pcf')
    vaos = {}
    for name, program in [('reduce', reduce_program), ('probe', probe)]:
        vao = C.c_uint()
        gen_vaos(1, C.byref(vao))
        bind_vao(vao)
        api.raw_buffer(struct.pack('<12f', -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1))
        location = api.GetAttribLocation(program, b'a_position')
        api.EnableVertexAttribArray(location)
        api.VertexAttribPointer(location, 2, 0x1406, 0, 0, None)
        vaos[name] = vao
    cases, pixels = 0, 0
    for pattern in ['flat', 'checker', 'needle', 'tagged', 'ramp', 'empty']:
        texels = bytearray()
        for y in range(size):
            for x in range(size):
                depth = .43
                if pattern in ['checker', 'tagged']:
                    depth = .35 if (x // 11 + y // 13) % 2 else .65
                elif pattern == 'needle':
                    depth = .1 if x % 4 == 2 and y % 4 == 2 else .8
                elif pattern == 'ramp':
                    depth = .2 + .6 * (x + y) / (size * 2 - 2)
                if pattern == 'empty':
                    texels.extend([255, 255, 255, 255])
                    continue
                parts = [(depth * scale) % 1 for scale in [1, 255, 65025]]
                parts[0] -= parts[1] / 255
                parts[1] -= parts[2] / 255
                texels.extend([round(v * 255) for v in parts] + [128 if pattern == 'tagged' and x % 3 == 0 else 255])
        shadow = api.texture(2, size, size, texels)
        api.bind_texture(7, 0)
        api.BindFramebuffer(0x8D40, bounds_fbo)
        api.Viewport(0, 0, size // 4, size // 4)
        api.Disable(0x0B71)
        api.Disable(0x0BD0)
        api.Disable(0x0BE2)
        api.UseProgram(reduce_program)
        bind_vao(vaos['reduce'])
        api.Uniform1i(api.GetUniformLocation(reduce_program, b'u_color'), 2)
        api.Uniform2f(api.GetUniformLocation(reduce_program, b'u_inputViewport'), size, size)
        api.DrawArrays(4, 0, 6)
        api.bind_texture(7, bounds_textures[0])
        api.BindFramebuffer(0x8D40, framebuffer)
        api.Viewport(0, 0, width, height)
        api.UseProgram(probe)
        bind_vao(vaos['probe'])
        for name, unit in [('staticShadowMap', 2), ('shadowBoundsMap', 7), ('shadowMap', 3), ('turfMap', 4)]:
            api.Uniform1i(api.GetUniformLocation(probe, ('u_' + name).encode()), unit)
        for name, value in {'testViewport': [width, height], 'shadowDepthRange': 2200,
                            'staticShadowTexel': 1 / size, 'shadowSoftness': 1,
                            'material': 15, 'hole': [0, 0, 60], 'apertureSin': [0, 0, 0],
                            'apertureCos': [1, 1, 1]}.items():
            api.set_uniform(probe, name, value)
        for quality in [0, 1, 2]:
            api.set_uniform(probe, 'shadowQuality', quality)
            for case, plane in enumerate([0, .0001, .01, .1, 10]):
                api.set_uniform(probe, 'testCase', case)
                api.set_uniform(probe, 'testPlane', plane)
                api.DrawArrays(4, 0, 6)
                result = api.pixels(width, height)
                if any(result[i] for i in range(0, len(result), 4)):
                    raise AssertionError(f'PCF divergence: {pattern}, quality={quality}, gradient={plane}')
                cases += 1
                pixels += width * height
    return {'cases': cases, 'comparedFragments': pixels, 'visibilityTolerance': 2e-6, 'mismatches': 0}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--angle-dir', required=True)
    args = parser.parse_args()
    directory = ROOT / 'tests' / 'resultados'
    source = json.loads((directory / 'sombras-limites-fontes.json').read_text(encoding='utf-8'))
    meshes = json.loads((directory / 'instancias-gpu-fontes.json').read_text(encoding='utf-8'))['meshes']
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
    filter_contract = verify_filter(api, source, gen_vaos, bind_vao)
    print('Contrato PCF: ' + json.dumps(filter_contract), flush=True)
    api.framebuffer, _ = api.target(width, height, 2, depth=True)
    programs = {}
    for name, pair in [(mode, source[mode]) for mode in ['before', 'after', 'depth']]:
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
                'shadowTexel': 1 / 1024, 'staticShadowTexel': 1 / 1024, 'shadowBoundsEnabled': 1,
                'shadowWorldTexel': 2, 'staticShadowWorldTexel': 4,
                'material': 14, 'tint': [1, 1, 1], 'reactive': 0, 'eye': eye,
                'hole': [100000, 100000, 0], 'depth': 0, 'travel': 0,
                'pixelScale': 2 * math.tan(.37) / height, 'instanced': 1}
    for program in programs.values():
        api.UseProgram(program)
        for name, value in uniforms.items():
            api.set_uniform(program, name, value)
        for name, unit in {'staticShadowMap': 2, 'shadowMap': 3, 'turfMap': 4, 'shadowBoundsMap': 7}.items():
            api.Uniform1i(api.GetUniformLocation(program, ('u_' + name).encode()), unit)
    texels = bytearray()
    for y in range(1024):
        for x in range(1024):
            depth = .43 if (x // 116 + y // 124) % 2 else .57
            parts = [(depth * scale) % 1 for scale in [1, 255, 65025]]
            parts[0] -= parts[1] / 255
            parts[1] -= parts[2] / 255
            texels.extend([round(v * 255) for v in parts] + [255])
    fixed = api.texture(2, 1024, 1024, texels)
    api.texture(3, 1, 1, [255, 255, 255, 255])
    api.texture(4, 1, 1, [255, 255, 255, 255])
    bounds_fbo, bounds_textures = api.target(256, 256)
    reduce_program = api.program(source['reduce'], 'shadow-bounds-reduction')
    reduce_vao = C.c_uint()
    gen_vaos(1, C.byref(reduce_vao))
    bind_vao(reduce_vao)
    api.raw_buffer(struct.pack('<12f', -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1))
    p = api.GetAttribLocation(reduce_program, b'a_position')
    api.EnableVertexAttribArray(p)
    api.VertexAttribPointer(p, 2, 0x1406, 0, 0, None)
    api.UseProgram(reduce_program)
    api.Uniform1i(api.GetUniformLocation(reduce_program, b'u_color'), 2)
    api.Uniform2f(api.GetUniformLocation(reduce_program, b'u_inputViewport'), 1024, 1024)
    api.BindFramebuffer(0x8D40, bounds_fbo)
    api.Viewport(0, 0, 256, 256)
    api.Disable(0x0B71)
    api.Disable(0x0BD0)
    api.Disable(0x0BE2)
    api.bind_texture(7, 0)
    api.bind_texture(2, fixed)
    api.DrawArrays(4, 0, 6)
    api.Finish()
    reduction_samples = []
    for _ in range(16):
        api.DrawArrays(4, 0, 6)
    api.Finish()
    for _ in range(9):
        query = C.c_uint()
        gen_queries(1, C.byref(query))
        begin_query(0x88BF, query)
        for _ in range(8):
            api.DrawArrays(4, 0, 6)
        end_query(0x88BF)
        api.Finish()
        value = C.c_uint64()
        query_result(query, 0x8866, C.byref(value))
        disjoint = C.c_int()
        get_integer(0x8FBB, C.byref(disjoint))
        delete_queries(1, C.byref(query))
        if not disjoint.value:
            reduction_samples.append(value.value / 1e6 / 8)
    api.bind_texture(7, bounds_textures[0])
    report = {'renderer': context.renderer, 'version': context.version, 'resolution': [width, height],
              'beforeReference': source['beforeReference'], 'filterContract': filter_contract,
              'staticReduction': {'sourceSize': 1024, 'gpuMs': statistics.median(reduction_samples),
                                  'samples': reduction_samples, 'bytes': 256 * 256 * 4},
              'method': 'EXT_disjoint_timer_query; 31 alternating samples per mode, 8 frames per query, after immediate alternating warmup; medians. Same mesh, instances, textures and lights; cached static reduction excluded from steady-state draw timing.',
              'browserFPS': None, 'temperature': None, 'cases': []}
    cases = [('arvore-densa', 96, 27, False), ('arvore-esparsa', 12, 76, False), ('banco', 64, 34, False),
             ('arvore-densa-profundidade', 96, 27, True), ('banco-profundidade', 64, 34, True)]
    for name, total, spacing, prepass in cases:
        vertices = base64.b64decode(meshes['arvore' if name.startswith('arvore') else 'banco'])
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
            if prepass:
                color_mask(0, 0, 0, 0)
                draw('depth')
                color_mask(1, 1, 1, 1)
                api.DepthFunc(0x0202)
                api.DepthMask(0)
            draw(mode)

        images, surfaces = {}, {}
        for mode in ['before', 'after']:
            for _ in range(32):
                frame(mode)
                api.Finish()
            images[mode] = api.pixels(width, height)
            surfaces[mode] = api.pixels(width, height, 1)
            LIGHTING.write_png(directory / f'sombras-limites-{name}-{mode}.png', width, height, images[mode])
        differences = {mode: sum(a != b for a, b in zip(images['before'], image)) for mode, image in images.items()}
        surface_differences = {mode: sum(a != b for a, b in zip(surfaces['before'], image)) for mode, image in surfaces.items()}
        maximum_error = {mode: max(abs(a - b) for a, b in zip(images['before'], image)) for mode, image in images.items()}
        if max(maximum_error.values()) > 1 or any(surface_differences.values()):
            raise AssertionError('Pixels/superfícies divergiram: ' + str((differences, surface_differences)))
        # Pixel readback/comparison can leave the GPU idle long enough to lower
        # its clocks. Warm both paths again immediately before the samples.
        for _ in range(16):
            for mode in images:
                frame(mode)
            api.Finish()
        samples = {mode: [] for mode in images}
        for sample in range(31):
            modes = list(images)
            if sample % 2:
                modes.reverse()
            for mode in modes:
                query = C.c_uint()
                gen_queries(1, C.byref(query))
                begin_query(0x88BF, query)
                for _ in range(8):
                    frame(mode)
                end_query(0x88BF)
                api.Finish()
                value = C.c_uint64()
                query_result(query, 0x8866, C.byref(value))
                disjoint = C.c_int()
                get_integer(0x8FBB, C.byref(disjoint))
                delete_queries(1, C.byref(query))
                if not disjoint.value:
                    samples[mode].append(value.value / 1e6 / 8)
        error = api.GetError()
        if error:
            raise AssertionError(f'GLES error 0x{error:04x}')
        entry = {'scene': name, 'instances': total, 'prepass': prepass, 'trianglesPerColorPass': total * len(vertices) // 108,
                 'differentChannels': differences, 'maximumChannelError': maximum_error,
                 'differentSurfaceChannels': surface_differences,
                 'gpuMs': {mode: statistics.median(v) for mode, v in samples.items()},
                 'samples': samples}
        report['cases'].append(entry)
        print(json.dumps({key: value for key, value in entry.items() if key != 'samples'}), flush=True)
    context.close()
    (directory / 'sombras-limites-gpu.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
