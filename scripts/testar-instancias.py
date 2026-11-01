"""Compare individual/instanced production meshes and shaders in real GLES.

Uses local ANGLE DLLs only; no browser, real saves or third party Python modules.
Run node scripts/preparar-instancias.mjs before this optional regression.
"""
import argparse
import base64
import ctypes as C
import importlib.util
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('vora_palette', ROOT / 'scripts' / 'testar-paleta.py')
PALETTE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PALETTE)
LIGHTING = PALETTE.LIGHTING


class InstanceTest(PALETTE.PaletteTest):
    def __init__(self, context):
        super().__init__(context)
        self.Divisor = LIGHTING.EGL.function(self.gl, 'glVertexAttribDivisor', None, C.c_uint, C.c_uint)
        self.DrawInstances = LIGHTING.EGL.function(self.gl, 'glDrawArraysInstanced', None, C.c_uint, C.c_int, C.c_int, C.c_int)
        self.DisableAttribute = LIGHTING.EGL.function(self.gl, 'glDisableVertexAttribArray', None, C.c_uint)

    def draw_case(self, program, vertices, records, instanced, render_pass, width, height):
        self.UseProgram(program)
        self.BindFramebuffer(0x8D40, self.framebuffer)
        self.Viewport(0, 0, width, height)
        self.ClearColor(.06, .10, .08, 1)
        self.DepthMask(1)
        self.Clear(0x4100)
        self.Enable(0x0B71)
        self.DepthFunc(0x0203)
        self.Disable(0x0B44)
        self.Disable(0x0BE2)
        self.Disable(0x0BD0)
        identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
        eye = [215, 280, 355]
        target = [0, 34, 0]
        near, far = 2., 4000.
        f = 1 / math.tan(.37)
        projection = [f / (width / height), 0, 0, 0, 0, f, 0, 0, 0, 0,
                      (far + near) / (near - far), -1, 0, 0, 2 * far * near / (near - far), 0]
        vp = LIGHTING.multiply(projection, LIGHTING.look_at(eye, target))
        uniforms = {'bodyRotation': identity, 'pivot': [0, 0, 0], 'viewProjection': vp,
                    'lightViewProjection': vp, 'renderPass': render_pass, 'shadowEnabled': 0,
                    'material': 14, 'tint': [1, 1, 1], 'reactive': 0, 'eye': eye,
                    'hole': [100000, 100000, 0], 'depth': 0, 'travel': 0,
                    'pixelScale': 2 * math.tan(.37) / height, 'instanced': int(instanced)}
        for name, value in uniforms.items():
            self.set_uniform(program, name, value)
        for name, unit in {'staticShadowMap': 2, 'shadowMap': 3, 'turfMap': 4}.items():
            self.Uniform1i(self.GetUniformLocation(program, ('u_' + name).encode()), unit)
        self.BindBuffer(0x8892, self.raw_buffer(vertices))
        for name, offset in [('position', 0), ('normal', 12), ('color', 24)]:
            location = self.GetAttribLocation(program, ('a_' + name).encode())
            if location >= 0:
                self.EnableVertexAttribArray(location)
                self.VertexAttribPointer(location, 3, 0x1406, 0, 36, C.c_void_p(offset))
        instance_locations = []
        for name, size, offset in [('instanceOrigin', 3, 0), ('instanceScale', 3, 12), ('instanceRotation', 1, 24)]:
            location = self.GetAttribLocation(program, ('a_' + name).encode())
            instance_locations.append((location, size, offset))
            self.DisableAttribute(location)
            self.Divisor(location, 0)
        count = len(vertices) // 36
        if instanced:
            packed = struct.pack('<' + 'f' * (len(records) * 7), *(v for record in records for v in record))
            self.BindBuffer(0x8892, self.raw_buffer(packed))
            for location, size, offset in instance_locations:
                self.EnableVertexAttribArray(location)
                self.VertexAttribPointer(location, size, 0x1406, 0, 28, C.c_void_p(offset))
                self.Divisor(location, 1)
            self.DrawInstances(4, 0, count, len(records))
        else:
            for record in records:
                self.set_uniform(program, 'origin', record[:3])
                self.set_uniform(program, 'scale', record[3:6])
                self.set_uniform(program, 'rotation', record[6])
                self.DrawArrays(4, 0, count)
        for location, _, _ in instance_locations:
            self.Divisor(location, 0)
            self.DisableAttribute(location)
        pixels = self.pixels(width, height)
        error = self.GetError()
        if error:
            raise AssertionError(f'Erro GLES 0x{error:04x}')
        return pixels


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--angle-dir', required=True)
    args = parser.parse_args()
    directory = ROOT / 'tests' / 'resultados'
    source = json.loads((directory / 'instancias-gpu-fontes.json').read_text(encoding='utf-8'))
    width, height = 640, 480
    context = LIGHTING.EGL(args.angle_dir, width, height)
    api = InstanceTest(context)
    api.framebuffer, _ = api.target(width, height, 2, depth=True)
    program = api.program(source['program'], 'instancing-production')
    for unit in [2, 3, 4]:
        api.texture(unit, 1, 1, [255, 255, 255, 255])
    records = [[(i % 8 - 3.5) * 38, 0, (i // 8 - 2.5) * 38,
                .65 + i % 4 * .18, .8 + i % 3 * .13, .7 + i % 5 * .09, i * .371] for i in range(48)]
    report = {'renderer': context.renderer, 'version': context.version, 'comparisons': [],
              'scope': 'Production shaders/meshes; identical transforms, nonuniform scales, rotations and viewport. No browser FPS measurement.'}
    for name, encoded in source['meshes'].items():
        data = base64.b64decode(encoded)
        for render_pass in [0, 1, 2]:
            individual = api.draw_case(program, data, records, False, render_pass, width, height)
            instanced = api.draw_case(program, data, records, True, render_pass, width, height)
            different = sum(a != b for a, b in zip(individual, instanced))
            max_error = max(abs(a - b) for a, b in zip(individual, instanced))
            entry = {'mesh': name, 'renderPass': render_pass, 'individualDraws': len(records),
                     'instancedDraws': 1, 'differentChannels': different, 'maxChannelError': max_error}
            report['comparisons'].append(entry)
            if render_pass == 0:
                LIGHTING.write_png(directory / f'instancias-{name}-individual.png', width, height, individual)
                LIGHTING.write_png(directory / f'instancias-{name}-lote.png', width, height, instanced)
            print(json.dumps(entry), flush=True)
            if different:
                raise AssertionError('Instancing alterou pixels: ' + name)
    api.DeleteProgram(program)
    context.close()
    (directory / 'instancias-gpu.json').write_text(json.dumps(report, indent=2), encoding='utf-8')


if __name__ == '__main__':
    main()
