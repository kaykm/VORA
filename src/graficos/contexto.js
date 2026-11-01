'use strict';
const $=id=>document.getElementById(id),canvas=$('world'),gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:true})||canvas.getContext('webgl',{antialias:false,alpha:false,depth:true})||new SoftwareGL(canvas);
const WEBGL2=!gl.isSoftware&&typeof gl.renderbufferStorageMultisample==='function'&&typeof gl.blitFramebuffer==='function';
