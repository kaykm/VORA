"""Replay production world, real shadow maps and AO in native GLES.

No browser, real saves or third-party Python dependencies. This is a visual
regression, not a browser FPS or power measurement.
"""
import argparse
import base64
import ctypes as C
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location('vora_palette', ROOT / 'scripts' / 'testar-paleta.py')
PALETTE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PALETTE)
LIGHTING = PALETTE.LIGHTING


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--angle-dir', required=True)
    args = parser.parse_args()
    directory = ROOT / 'tests' / 'resultados'
    source = json.loads((directory / 'revisao-visual-fontes.json').read_text(encoding='utf-8'))
    width, height = source['width'], source['height']
    context = LIGHTING.EGL(args.angle_dir, width, height)
    api = PALETTE.PaletteTest(context)
    uniform_locations = {}
    samplers = {'staticShadowMap': 2, 'shadowMap': 3, 'turfMap': 4, 'shadowBoundsMap': 7}

    def uniform(program, name, value):
        key = program, name
        if key not in uniform_locations:
            uniform_locations[key] = api.GetUniformLocation(program, ('u_' + name).encode())
        location = uniform_locations[key]
        if location < 0:
            return
        if isinstance(value, (int, float)):
            api.Uniform1f(location, value)
        elif len(value) == 16:
            api.UniformMatrix4fv(location, 1, 0, (C.c_float * 16)(*value))
        else:
            {2: api.Uniform2f, 3: api.Uniform3f, 4: api.Uniform4f}[len(value)](location, *value)

    report = {'renderer': context.renderer, 'resolution': [width, height], 'baseline': source['baseline'],
              'scope': 'Production world/meshes/materials/shadows/AO in native GLES. Individual submission instead of instancing; conservative shadow-bound shortcut disabled. No browser layout/FPS/power or real saves.',
              'scenes': {}}
    for version in ['before', 'after']:
        entry = source[version]
        print('Compilando cena e AO: ' + version, flush=True)
        programs = {name: api.program(pair, version + '-' + name) for name, pair in entry['programs'].items()}
        scene_program = programs['scene']
        buffers = [api.raw_buffer(base64.b64decode(value)) for value in entry['buffers']]
        white = api.texture(6, 1, 1, [255, 255, 255, 255])
        turf = api.texture(4, 512, 512, base64.b64decode(entry['turf']))
        api.GenerateMipmap(0x0DE1)
        api.TexParameteri(0x0DE1, 0x2801, 0x2703)
        api.TexParameteri(0x0DE1, 0x2800, 0x2601)
        api.TexParameteri(0x0DE1, 0x2802, 0x2901)
        api.TexParameteri(0x0DE1, 0x2803, 0x2901)
        fixed_fbo, fixed_textures = api.target(2048, 2048, depth=True)
        moving_fbo, moving_textures = api.target(1024, 1024, depth=True)
        scene_fbo, scene_textures = api.target(width, height, 2, depth=True)

        def draw_mesh(draw, enabled=None):
            for name, value in draw['uniforms'].items():
                if name not in samplers:
                    uniform(scene_program, name, value)
            if enabled is not None:
                uniform(scene_program, 'shadowEnabled', enabled)
            uniform(scene_program, 'shadowBoundsEnabled', 0)
            uniform(scene_program, 'instanced', 0)
            api.BindBuffer(0x8892, buffers[draw['buffer']])
            for name, offset in [('position', 0), ('normal', 12), ('color', 24)]:
                location = api.GetAttribLocation(scene_program, ('a_' + name).encode())
                if location < 0:
                    continue
                api.EnableVertexAttribArray(location)
                api.VertexAttribPointer(location, 3, 0x1406, 0, 36, C.c_void_p(offset))
            api.DrawArrays(4, draw['first'], draw['count'])

        for name, shot in entry['scenes'].items():
            print('Renderizando ' + version + '/' + name, flush=True)
            api.UseProgram(scene_program)
            api.Enable(0x0B71)
            api.DepthFunc(0x0203)
            api.DepthMask(1)
            for capability in [0x0B44, 0x0BE2, 0x0BD0]:
                api.Disable(capability)
            for sampler, unit in samplers.items():
                api.Uniform1i(api.GetUniformLocation(scene_program, ('u_' + sampler).encode()), unit)
            api.bind_texture(4, turf)
            api.bind_texture(7, turf)
            for render_pass, framebuffer, size in [(2, fixed_fbo, 2048), (1, moving_fbo, 1024)]:
                api.BindFramebuffer(0x8D40, framebuffer)
                api.Viewport(0, 0, size, size)
                api.bind_texture(2, white)
                api.bind_texture(3, white)
                api.ClearColor(1, 1, 1, 1)
                api.Clear(0x4100)
                for draw in shot['draws']:
                    if draw['uniforms'].get('renderPass', 0) == render_pass:
                        draw_mesh(draw)
            images = {}
            for label, enabled in [('base', 0), ('sombras', 1)]:
                api.BindFramebuffer(0x8D40, scene_fbo)
                api.Viewport(0, 0, width, height)
                api.bind_texture(2, fixed_textures[0])
                api.bind_texture(3, moving_textures[0])
                api.ClearColor(.66, .715, .64, 1)
                api.Clear(0x4100)
                for draw in shot['draws']:
                    if draw['uniforms'].get('renderPass', 0) == 0:
                        draw_mesh(draw, enabled)
                images[label] = api.pixels(width, height)
                LIGHTING.write_png(directory / f'revisao-{version}-{name}-{label}.png', width, height, images[label])
            api.view_rotation = shot['viewRotation']
            textures = [scene_textures[0], scene_textures[1], None, scene_textures[2]]
            _, _, final, disabled = api.pipeline(programs, textures, (width, height), (width, height), entry['aoSettings'], 1)
            error = max(abs(a - b) for a, b in zip(disabled, images['sombras']))
            if error > 1:
                raise AssertionError('Composição com AO desligado mudou a cena: ' + str(error))
            LIGHTING.write_png(directory / f'revisao-{version}-{name}-completa.png', width, height, final)
            different = sum(a != b for a, b in zip(images['sombras'], final))
            if different < 100:
                raise AssertionError('AO ficou inativo no mundo real.')
            report['scenes'][version + '-' + name] = {'draws': len(shot['draws']), 'triangles': shot['triangles'],
                'aoSettings': entry['aoSettings'], 'aoAffectedChannels': different, 'aoDisabledMaxError': error}
            if name in ['meio-fio', 'relva']:
                # In these controls the named geometry is the only static
                # caster and the live map is empty. Count darkening on grass,
                # excluding stone surfaces and the excavation itself.
                projected = 0
                base, shaded = images['base'], images['sombras']
                for offset in range(0, len(base), 4):
                    r, g, b = base[offset:offset+3]
                    if g > r * 1.08 and g > b * 1.20 and max(base[offset+c]-shaded[offset+c] for c in range(3)) > 8:
                        projected += 1
                report['scenes'][version + '-' + name]['projectedContactPixels'] = projected
                if version == 'before' and projected:
                    raise AssertionError(f'Controle anterior recebeu outro emissor: {name}, {projected}')
                if version == 'after' and projected < 100:
                    raise AssertionError(f'Sombra de contato ausente: {name}, {projected}')
    context.close()
    (directory / 'revisao-visual-gpu.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2), flush=True)


if __name__ == '__main__':
    main()
