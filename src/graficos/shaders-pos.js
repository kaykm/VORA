// FidelityFX Super Resolution Sample
//
// Copyright (c) 2021 Advanced Micro Devices, Inc. All rights reserved.
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and / or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions :
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
// GLSL ES 1.00 FP32 adaptation: scalar texel reads replace textureGather.
const FSR_EASU_SOURCE=/* @text src/graficos/shaders/fsr-easu.glsl */;
// This file is part of the FidelityFX SDK.
//
// Copyright (C) 2026 Advanced Micro Devices, Inc.
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files(the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and /or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions :
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

/// @defgroup FfxGPUFsr1 FidelityFX FSR1
// Adapted from GPUOpen-LibrariesAndSDKs/FidelityFX-SDK: current gpu/fsr1/ffx_fsr1.h.
// Spatial version 1.2.0 is identified in the SDK host header and GPUOpen manual.
const FSR_RCAS_SOURCE=/* @text src/graficos/shaders/fsr-rcas.glsl */;

const AA_PRESENT_SOURCE=/* @text src/graficos/shaders/apresentacao.glsl */;
const AA_DOWNSAMPLE_SOURCE=/* @text src/graficos/shaders/reducao.glsl */;
const AA_TEMPORAL_SOURCE=/* @text src/graficos/shaders/temporal.glsl */;
const SMAA_LIBRARY=/* @text src/graficos/shaders/smaa.glsl */;
const SMAA_LOOKUPS=/* @json assets/smaa/lookup.json */;

const AO_SURFACE_GLSL=/* @text src/graficos/shaders/ao-superficie.glsl */;
const AO_HORIZON_SOURCE=/* @template src/graficos/shaders/ao-horizonte.glsl */;
const AO_DENOISE_SOURCE=/* @template src/graficos/shaders/ao-filtro.glsl */;
