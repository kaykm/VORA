"""Renderiza as cenas exportadas por preparar-paleta.mjs em OpenGL ES real.

Uso: python scripts/testar-paleta.py --angle-dir "pasta do ANGLE"
Usa só Python padrão e DLLs locais. Não abre navegador nem acessa saves.
"""
import argparse
import base64
import ctypes as C
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parent.parent
SPEC=importlib.util.spec_from_file_location('vora_lighting',ROOT/'scripts'/'testar-iluminacao.py')
LIGHTING=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(LIGHTING)


def color_metrics(pixels):
    count=len(pixels)//4
    saturation=luminance=0.
    clipped=0
    for offset in range(0,len(pixels),4):
        r,g,b=pixels[offset:offset+3]
        high,low=max(r,g,b),min(r,g,b)
        saturation+=(high-low)/max(high,1)
        luminance+=(.2126*r+.7152*g+.0722*b)/255
        clipped+=sum(value in (0,255) for value in (r,g,b))
    return {'pixels':count,'meanHsvSaturation':saturation/count,
            'meanLuminance':luminance/count,'fractionClippedChannels':clipped/(count*3)}


class PaletteTest(LIGHTING.LightingTest):
    def __init__(self,context):
        super().__init__(context)
        self.DepthMask=LIGHTING.EGL.function(self.gl,'glDepthMask',None,C.c_ubyte)
        self.BlendFunc=LIGHTING.EGL.function(self.gl,'glBlendFunc',None,C.c_uint,C.c_uint)
        self.GenerateMipmap=LIGHTING.EGL.function(self.gl,'glGenerateMipmap',None,C.c_uint)

    def raw_buffer(self,data):
        value=C.c_uint()
        self.GenBuffers(1,C.byref(value))
        self.BindBuffer(0x8892,value)
        raw=C.create_string_buffer(data)
        self.BufferData(0x8892,len(data),raw,0x88E4)
        return value

    def set_uniform(self,program,name,value):
        location=self.GetUniformLocation(program,('u_'+name).encode())
        if location<0:return
        if isinstance(value,(int,float)):
            self.Uniform1f(location,value)
        elif len(value)==16:
            self.UniformMatrix4fv(location,1,0,(C.c_float*16)(*value))
        elif len(value)==9:
            self.UniformMatrix3fv(location,1,0,(C.c_float*9)(*value))
        elif len(value)==4:self.Uniform4f(location,*value)
        elif len(value)==3:self.Uniform3f(location,*value)
        elif len(value)==2:self.Uniform2f(location,*value)
        else:raise ValueError('Uniform não suportado: '+name)

    def scene(self,program,scene,buffers,width,height):
        self.UseProgram(program)
        self.BindFramebuffer(0x8D40,self.framebuffer)
        self.Viewport(0,0,width,height)
        self.ClearColor(.66,.715,.64,1)
        self.DepthMask(1)
        self.Clear(0x4100)
        self.Enable(0x0B71)
        self.DepthFunc(0x0203)
        self.Disable(0x0B44)
        self.Disable(0x0BE2)
        self.Disable(0x0BD0)
        identity=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
        for name,value in {'lightViewProjection':identity,'bodyRotation':identity,
                           'liveShadowWindow':[0,0,1,1],'origin':[0,0,0],'scale':[1,1,1],
                           'tint':[1,1,1],'pivot':[0,0,0],'renderPass':0,'shadowEnabled':0,
                           'reactive':0,'rotation':0}.items():self.set_uniform(program,name,value)
        for name,unit in {'staticShadowMap':2,'shadowMap':3,'turfMap':4}.items():
            self.Uniform1i(self.GetUniformLocation(program,('u_'+name).encode()),unit)
        for draw in scene['draws']:
            for name,value in draw['uniforms'].items():self.set_uniform(program,name,value)
            self.set_uniform(program,'shadowEnabled',0)
            self.set_uniform(program,'renderPass',0)
            if draw['blend']:
                self.Enable(0x0BE2);self.BlendFunc(0x0302,0x0303)
            else:self.Disable(0x0BE2)
            self.DepthMask(int(draw['depthWrite']))
            self.BindBuffer(0x8892,buffers[draw['buffer']])
            for name,offset in (('position',0),('normal',12),('color',24)):
                attribute=self.GetAttribLocation(program,('a_'+name).encode())
                if attribute<0:continue
                self.EnableVertexAttribArray(attribute)
                self.VertexAttribPointer(attribute,3,0x1406,0,36,C.c_void_p(offset))
            self.DrawArrays(4,draw['first'],draw['count'])
        return self.pixels(width,height)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--angle-dir',required=True)
    args=parser.parse_args()
    directory=ROOT/'tests'/'resultados'
    source=json.loads((directory/'paleta-fontes.json').read_text(encoding='utf8'))
    width,height=source['width'],source['height']
    context=LIGHTING.EGL(args.angle_dir,width,height)
    api=PaletteTest(context)
    api.framebuffer,_=api.target(width,height,2,depth=True)
    report={'renderer':context.renderer,'version':context.version,'scope':source['scope'],
            'beforeReference':source['beforeReference'],'scenes':{}}
    for version in ('before','after'):
        entry=source[version]
        print('Compilando o shader da cena: '+version,flush=True)
        program=api.program(entry['program'],'paleta-'+version)
        buffers=[api.raw_buffer(base64.b64decode(value)) for value in entry['buffers']]
        api.texture(2,1,1,[255,255,255,255])
        api.texture(3,1,1,[255,255,255,255])
        api.texture(4,512,512,base64.b64decode(entry['turf']))
        api.GenerateMipmap(0x0DE1)
        api.TexParameteri(0x0DE1,0x2801,0x2703)
        api.TexParameteri(0x0DE1,0x2800,0x2601)
        api.TexParameteri(0x0DE1,0x2802,0x2901)
        api.TexParameteri(0x0DE1,0x2803,0x2901)
        for name,scene in entry['scenes'].items():
            pixels=api.scene(program,scene,buffers,width,height)
            measured=color_metrics(pixels)
            measured.update({'drawCalls':len(scene['draws']),'triangles':scene['triangles']})
            report['scenes'][version+'-'+name]=measured
            LIGHTING.write_png(directory/f'paleta-{version}-{name}.png',width,height,pixels)
            print('Imagem concluída: paleta-'+version+'-'+name+'.png',flush=True)
        api.DeleteProgram(program)
    context.close()
    (directory/'paleta-gpu.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
