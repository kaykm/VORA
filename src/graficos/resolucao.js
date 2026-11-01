function resize(){W=innerWidth;H=innerHeight;
 const maxDimension=gl.isSoftware?1:Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE),gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
 const requested=state.outputMode==='native'?(devicePixelRatio||1):Math.min(devicePixelRatio||1,1.35);
 dpr=gl.isSoftware?Math.min(1,640/W,680/H):Math.min(requested,maxDimension/Math.max(W,H),Math.sqrt(16000000/(W*H)));
 canvas.width=Math.max(1,Math.round(W*dpr));canvas.height=Math.max(1,Math.round(H*dpr));gl.viewport(0,0,canvas.width,canvas.height);pausedRenderStamp='';resizeLighting();
}window.addEventListener('resize',resize);
