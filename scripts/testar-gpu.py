"""Compila os shaders do jogo e reproduz AO + névoa em OpenGL ES real.

Uso (depois de node scripts/preparar-gpu.mjs):
python scripts/testar-gpu.py --angle-dir "pasta com libEGL.dll e libGLESv2.dll"
Nenhum navegador, perfil, save ou acesso à rede é utilizado.
"""
import argparse
import ctypes as C
import json
import math
import struct
import sys
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests'))
from egl import EGL


def write_png(file, width, height, pixels):
    def chunk(name, data):
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', zlib.crc32(name + data))
    rows = b''.join(b'\0' + pixels[y * width * 4:(y + 1) * width * 4] for y in range(height - 1, -1, -1))
    header = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    file.write_bytes(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', header) + chunk(b'IDAT', zlib.compress(rows)) + chunk(b'IEND', b''))


class ShaderTest:
    def __init__(self, context):
        self.context, self.gl = context, context.gl
        signatures = {
            'CreateShader': (C.c_uint, C.c_uint),
            'ShaderSource': (None, C.c_uint, C.c_int, C.POINTER(C.c_char_p), C.POINTER(C.c_int)),
            'CompileShader': (None, C.c_uint),
            'GetShaderiv': (None, C.c_uint, C.c_uint, C.POINTER(C.c_int)),
            'GetShaderInfoLog': (None, C.c_uint, C.c_int, C.POINTER(C.c_int), C.c_void_p),
            'DeleteShader': (None, C.c_uint),
            'CreateProgram': (C.c_uint,),
            'AttachShader': (None, C.c_uint, C.c_uint),
            'LinkProgram': (None, C.c_uint),
            'GetProgramiv': (None, C.c_uint, C.c_uint, C.POINTER(C.c_int)),
            'GetProgramInfoLog': (None, C.c_uint, C.c_int, C.POINTER(C.c_int), C.c_void_p),
            'UseProgram': (None, C.c_uint),
            'DeleteProgram': (None, C.c_uint),
            'GetUniformLocation': (C.c_int, C.c_uint, C.c_char_p),
            'Uniform1i': (None, C.c_int, C.c_int),
            'Uniform1f': (None, C.c_int, C.c_float),
            'Uniform2f': (None, C.c_int, C.c_float, C.c_float),
            'UniformMatrix3fv': (None, C.c_int, C.c_int, C.c_ubyte, C.POINTER(C.c_float)),
            'GetAttribLocation': (C.c_int, C.c_uint, C.c_char_p),
            'GenBuffers': (None, C.c_int, C.POINTER(C.c_uint)),
            'BindBuffer': (None, C.c_uint, C.c_uint),
            'BufferData': (None, C.c_uint, C.c_ssize_t, C.c_void_p, C.c_uint),
            'EnableVertexAttribArray': (None, C.c_uint),
            'VertexAttribPointer': (None, C.c_uint, C.c_int, C.c_uint, C.c_ubyte, C.c_int, C.c_void_p),
            'GenTextures': (None, C.c_int, C.POINTER(C.c_uint)),
            'ActiveTexture': (None, C.c_uint),
            'BindTexture': (None, C.c_uint, C.c_uint),
            'TexParameteri': (None, C.c_uint, C.c_uint, C.c_int),
            'TexImage2D': (None, C.c_uint, C.c_int, C.c_int, C.c_int, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_void_p),
            'Viewport': (None, C.c_int, C.c_int, C.c_int, C.c_int),
            'Disable': (None, C.c_uint),
            'DrawArrays': (None, C.c_uint, C.c_int, C.c_int),
            'ReadPixels': (None, C.c_int, C.c_int, C.c_int, C.c_int, C.c_uint, C.c_uint, C.c_void_p),
            'GetError': (C.c_uint,),
            'Finish': (None,),
        }
        for name, signature in signatures.items():
            setattr(self, name, EGL.function(self.gl, 'gl' + name, *signature))

    def compile(self, kind, source, label):
        shader = self.CreateShader(kind)
        text = C.c_char_p(source.encode())
        self.ShaderSource(shader, 1, C.byref(text), None)
        self.CompileShader(shader)
        status = C.c_int()
        self.GetShaderiv(shader, 0x8B81, C.byref(status))
        if not status.value:
            log = C.create_string_buffer(32768)
            self.GetShaderInfoLog(shader, len(log), None, log)
            raise RuntimeError(label + ': ' + log.value.decode())
        return shader

    def program(self, pair, label):
        vertex = self.compile(0x8B31, pair[0], label + '/vertex')
        fragment = self.compile(0x8B30, pair[1], label + '/fragment')
        program = self.CreateProgram()
        self.AttachShader(program, vertex)
        self.AttachShader(program, fragment)
        self.LinkProgram(program)
        status = C.c_int()
        self.GetProgramiv(program, 0x8B82, C.byref(status))
        if not status.value:
            log = C.create_string_buffer(32768)
            self.GetProgramInfoLog(program, len(log), None, log)
            raise RuntimeError(label + ': ' + log.value.decode())
        self.DeleteShader(vertex)
        self.DeleteShader(fragment)
        return program

    def texture(self, unit, width, height, data, floating=False):
        texture = C.c_uint()
        self.GenTextures(1, C.byref(texture))
        self.ActiveTexture(0x84C0 + unit)
        self.BindTexture(0x0DE1, texture)
        for key in (0x2801, 0x2800):
            self.TexParameteri(0x0DE1, key, 0x2600)
        for key in (0x2802, 0x2803):
            self.TexParameteri(0x0DE1, key, 0x812F)
        pixels = (C.c_float * len(data))(*data) if floating else C.create_string_buffer(bytes(data))
        self.TexImage2D(0x0DE1, 0, 0x822E if floating else 0x1908, width, height, 0,
                        0x1903 if floating else 0x1908, 0x1406 if floating else 0x1401, pixels)
        return texture

    def render(self, program, width, height, has_surface, ao_enabled=True):
        self.UseProgram(program)
        def location(name):
            return self.GetUniformLocation(program, ('u_' + name).encode())
        for name, unit in {'color': 0, 'sceneDepth': 1, 'surface': 2, 'ao': 3}.items():
            self.Uniform1i(location(name), unit)
        for name, value in {'aaKind': 0, 'hasSurface': has_surface, 'aoRadius': 13.5,
                            'aoStrength': 1.4, 'aoSlices': 3, 'aoSteps': 4,
                            'aoEnabled': int(ao_enabled)}.items():
            self.Uniform1f(location(name), value)
        for name, value in {'resolution': (width, height), 'activeScale': (1, 1),
                            'projection': (math.tan(.37) * width / height, math.tan(.37)),
                            'projectionJitter': (0, 0), 'aoViewport': (width, height),
                            'aoResource': (width, height)}.items():
            self.Uniform2f(location(name), *value)
        matrix = (C.c_float * 9)(1, 0, 0, 0, 1, 0, 0, 0, 1)
        self.UniformMatrix3fv(location('viewRotation'), 1, 0, matrix)
        vertices = (C.c_float * 12)(-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1)
        buffer = C.c_uint()
        self.GenBuffers(1, C.byref(buffer))
        self.BindBuffer(0x8892, buffer)
        self.BufferData(0x8892, C.sizeof(vertices), vertices, 0x88E4)
        attribute = self.GetAttribLocation(program, b'a_position')
        self.EnableVertexAttribArray(attribute)
        self.VertexAttribPointer(attribute, 2, 0x1406, 0, 0, None)
        self.Viewport(0, 0, width, height)
        for capability in (0x0B71, 0x0BE2, 0x0BD0):
            self.Disable(capability)
        self.DrawArrays(4, 0, 6)
        pixels = C.create_string_buffer(width * height * 4)
        self.ReadPixels(0, 0, width, height, 0x1908, 0x1401, pixels)
        self.Finish()
        error = self.GetError()
        if error:
            raise RuntimeError(f'OpenGL error 0x{error:04x}')
        return pixels.raw


def scenario(width, height):
    fog_color = (.66, .715, .64)
    surface_color = (.22, .39, .14)
    color, depth, normals, ao, samples = bytearray(), [], bytearray(), bytearray(), []
    for y in range(height):
        for x in range(width):
            band = min(2, x * 3 // width)
            cx = (band + .5) * width / 3
            tree = ((x - cx) / 65) ** 2 + ((y - height * .59) / 70) ** 2 < 1 or (abs(x - cx) < 10 and height * .1 < y < height * .6)
            z = (1000., 3300., 3900.)[band]
            vx = ((x + .5) / width * 2 - 1) * math.tan(.37) * width / height * z
            vy = ((y + .5) / height * 2 - 1) * math.tan(.37) * z
            distance = math.sqrt(vx * vx + vy * vy + z * z)
            t = min(1, max(0, (distance - 2850) / 1000))
            fog = t * t * (3 - 2 * t)
            rgb = tuple(surface_color[k] * (1 - fog) + fog_color[k] * fog for k in range(3)) if tree else fog_color
            quantized = [round(v * 255) for v in rgb]
            color.extend(quantized + [255])
            depth.append(((4002 - 16000 / z) / 3998 + 1) / 2 if tree else 1.)
            normals.extend([128, 128, 148, 255])
            packed = round((z if tree else 4000) / 4000 * 65535)
            ao.extend([51 if tree else 255, packed // 256, packed % 256, 0])
            if tree and abs(x - cx) < 25 and abs(y - height * .59) < 20:
                samples.append((x, y, band, fog, quantized))
    return color, depth, normals, ao, samples


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--angle-dir', required=True)
    args = parser.parse_args()
    result_dir = ROOT / 'tests' / 'resultados'
    sources = json.loads((result_dir / 'gpu-fontes.json').read_text())
    width, height = 720, 240
    context = EGL(args.angle_dir, width, height)
    api = ShaderTest(context)
    compiled, compositions, ao_passes = [], {}, {}
    for version, programs in sources.items():
        for name, variants in programs.items():
            for profile, pair in variants.items():
                if pair is None:
                    continue
                label = f'{version}/{name}/{profile}'
                program = api.program(pair, label)
                compiled.append(label)
                if name == 'composition':
                    compositions[(version, profile)] = program
                elif version == 'after' and name in ('horizon', 'denoise'):
                    ao_passes[(name, profile)] = program
                else:
                    api.DeleteProgram(program)
    color, depth, normals, ao, samples = scenario(width, height)
    for unit, data in enumerate((color, depth, normals, ao)):
        api.texture(unit, width, height, data, floating=unit == 1)
    results = []
    for profile in ('es100', 'es300'):
        for has_surface in (0, 1):
            before = api.render(compositions[('before', profile)], width, height, has_surface)
            after = api.render(compositions[('after', profile)], width, height, has_surface)
            disabled = api.render(compositions[('after', profile)], width, height, has_surface, False)
            assert max(abs(disabled[i] - color[i]) for i in range(len(color))) <= 1, 'AO desligado alterou a imagem'
            ambient = 148 / 255 if has_surface else .58
            errors, near_differences, near_attenuation, old_far_error, new_far_error = [], [], [], [], []
            for x, y, band, fog, pixel in samples:
                offset = (y * width + x) * 4
                for channel in range(3):
                    # The redesigned AO has a .58 visibility floor. This fixture
                    # deliberately supplies .2, exercising that safety contract
                    # and fog preservation independently of the AO estimator.
                    expected = pixel[channel] - max(0, pixel[channel] - (.66, .715, .64)[channel] * fog * 255) * .42 * ambient
                    errors.append(abs(after[offset + channel] - expected))
                    if band == 0:
                        near_differences.append(abs(after[offset + channel] - before[offset + channel]))
                        near_attenuation.append(pixel[channel] - after[offset + channel])
                    if band == 2:
                        old_far_error.append(abs(before[offset + channel] - color[offset + channel]))
                        new_far_error.append(abs(after[offset + channel] - color[offset + channel]))
            assert max(errors) <= 2, f'Composição incorreta: erro {max(errors)}'
            assert max(near_attenuation) > 10, 'AO deixou de atenuar a superfície próxima'
            assert max(new_far_error) <= 1 and max(old_far_error) > 50, 'Contorno distante não foi eliminado'
            results.append({'profile': profile, 'surfaceBuffer': bool(has_surface), 'maxColorError': max(errors),
                            'oldFogError': max(old_far_error), 'newFogError': max(new_far_error),
                            'nearAoDifference': max(near_differences), 'nearSurfaceAttenuation': max(near_attenuation)})
            if profile == 'es300' and has_surface:
                write_png(result_dir / 'nevoa-antes-gpu.png', width, height, before)
                write_png(result_dir / 'nevoa-depois-gpu.png', width, height, after)
    # Exercise the actual horizon and denoise programs as well as composition.
    ao_checks = []
    for profile in ('es100', 'es300'):
        horizon = api.render(ao_passes[('horizon', profile)], width, height, 1)
        api.texture(0, width, height, horizon)
        filtered = api.render(ao_passes[('denoise', profile)], width, height, 1)
        far_samples = [(y * width + x) * 4 for x, y, band, fog, pixel in samples if band == 2]
        assert all(horizon[i] == 255 and filtered[i] == 255 for i in far_samples), 'AO permaneceu ativo dentro de névoa opaca'
        ao_checks.append({'profile': profile, 'fullyFoggedAo': 'neutral in horizon and denoise'})
        api.texture(0, width, height, color)
    # A fully open plane must remain neutral all the way to the viewport edge,
    # including one-sided depth differences after neighbor coordinates clamp.
    plane_depth = ((4002 - 16000 / 200) / 3998 + 1) / 2
    api.texture(1, width, height, [plane_depth] * (width * height), floating=True)
    plane_checks = []
    for profile in ('es100', 'es300'):
        plane = api.render(ao_passes[('horizon', profile)], width, height, 1)
        minimum = min(plane[0::4])
        assert minimum >= 254, f'AO escureceu um plano aberto na borda: {profile}, {minimum}'
        plane_checks.append({'profile': profile, 'minimumOpenPlaneVisibilityByte': minimum})
    report = {'renderer': context.renderer, 'version': context.version, 'compiledPrograms': len(compiled),
              'programs': compiled, 'fogRegression': results,
              'aoPasses': ao_checks, 'openPlaneEdges': plane_checks,
              'scope': 'OpenGL ES offscreen real; cena sintética com os shaders reais do jogo. Sem navegador/DOM, FPS ou memória do navegador.'}
    (result_dir / 'gpu-verificacao.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({k: v for k, v in report.items() if k != 'programs'}, indent=2))
    context.close()


if __name__ == '__main__':
    main()
