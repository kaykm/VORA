"""Contexto OpenGL ES offscreen usando uma instalação local do ANGLE.

Não inicia nem controla navegador. Usa apenas ctypes e uma superfície em memória.
O caminho das DLLs é fornecido explicitamente por quem executa o teste.
"""
import ctypes as C
import os
from pathlib import Path


class EGL:
    def __init__(self, directory, width=640, height=240):
        self.directory = Path(directory).resolve()
        self.dll_directory = os.add_dll_directory(str(self.directory))
        self.egl = C.WinDLL(str(self.directory / 'libEGL.dll'))
        self.gl = C.WinDLL(str(self.directory / 'libGLESv2.dll'))
        self.width, self.height = width, height
        self.get_display = self.function(self.egl, 'eglGetDisplay', C.c_void_p, C.c_void_p)
        self.initialize = self.function(self.egl, 'eglInitialize', C.c_uint, C.c_void_p, C.POINTER(C.c_int), C.POINTER(C.c_int))
        self.choose = self.function(self.egl, 'eglChooseConfig', C.c_uint, C.c_void_p, C.POINTER(C.c_int), C.POINTER(C.c_void_p), C.c_int, C.POINTER(C.c_int))
        self.create_surface = self.function(self.egl, 'eglCreatePbufferSurface', C.c_void_p, C.c_void_p, C.c_void_p, C.POINTER(C.c_int))
        self.create_context = self.function(self.egl, 'eglCreateContext', C.c_void_p, C.c_void_p, C.c_void_p, C.c_void_p, C.POINTER(C.c_int))
        self.make_current = self.function(self.egl, 'eglMakeCurrent', C.c_uint, C.c_void_p, C.c_void_p, C.c_void_p, C.c_void_p)
        self.get_error = self.function(self.egl, 'eglGetError', C.c_uint)
        self.display = self.get_display(None)
        major, minor = C.c_int(), C.c_int()
        self.check(self.initialize(self.display, C.byref(major), C.byref(minor)), 'eglInitialize')
        attributes = (C.c_int * 15)(0x3033, 1, 0x3040, 0x40, 0x3024, 8, 0x3023, 8, 0x3022, 8, 0x3021, 8, 0x3025, 24, 0x3038)
        config, count = C.c_void_p(), C.c_int()
        self.check(self.choose(self.display, attributes, C.byref(config), 1, C.byref(count)) and count.value, 'eglChooseConfig ES3')
        surface_attributes = (C.c_int * 5)(0x3057, width, 0x3056, height, 0x3038)
        self.surface = self.create_surface(self.display, config, surface_attributes)
        context_attributes = (C.c_int * 3)(0x3098, 3, 0x3038)
        self.context = self.create_context(self.display, config, None, context_attributes)
        self.check(self.surface and self.context, 'contexto e superfície offscreen')
        self.check(self.make_current(self.display, self.surface, self.surface, self.context), 'eglMakeCurrent')
        get_string = self.function(self.gl, 'glGetString', C.c_char_p, C.c_uint)
        self.renderer = get_string(0x1F01).decode()
        self.version = get_string(0x1F02).decode()

    @staticmethod
    def function(library, name, result, *arguments):
        function = getattr(library, name)
        function.restype, function.argtypes = result, list(arguments)
        return function

    def check(self, result, name):
        if not result:
            raise RuntimeError(f'{name}: EGL 0x{self.get_error():04x}')

    def close(self):
        self.make_current(self.display, None, None, None)
        self.function(self.egl, 'eglDestroyContext', C.c_uint, C.c_void_p, C.c_void_p)(self.display, self.context)
        self.function(self.egl, 'eglDestroySurface', C.c_uint, C.c_void_p, C.c_void_p)(self.display, self.surface)
        self.function(self.egl, 'eglTerminate', C.c_uint, C.c_void_p)(self.display)
