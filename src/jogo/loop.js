let fpsWindowStart = null, fpsFrames = 0;

function resetFpsCounter() {
 fpsWindowStart = null;
 fpsFrames = 0;
 $('fpsValue').textContent = '—';
}

function recordFpsFrame(now, rendered) {
 if (state.showFps !== true || document.hidden) return;
 if (fpsWindowStart === null) {
  fpsWindowStart = now;
  fpsFrames = 0;
  return;
 }
 if (rendered) fpsFrames++;

 const elapsed = now - fpsWindowStart;
 if (elapsed >= 600) {
  $('fpsValue').textContent = (gl.isSoftware && openMenu || sceneFrameCache.reusing)
   ? '—' : String(Math.round(fpsFrames * 1000 / elapsed));
  fpsWindowStart = now;
  fpsFrames = 0;
 }
}

document.addEventListener('visibilitychange', resetFpsCounter);

function advanceGameSimulation(now) {
 processResourceWork(gl.isSoftware ? 2 : 3);
 maintainVegetationResources(now);
 observeImageCadence(now - last);

 let dt = Math.min(.1, (now - last) / 1000 || .016);
 last = now;
 time += dt;
 while (dt > 0) {
  const step = Math.min(dt, 1 / 60);
  update(step);
  dt -= step;
 }

 if ((cargoPhysicsDirty || spawnDirty) && now - cargoLastSave > 1500) {
  persist();
  cargoLastSave = now;
 }
}

function drawGameFrame(now) {
 if (insidePinned) drawInside(now);
 if (!shouldRenderSceneFrame()) {
  if (sceneFrameCache.vp) {
   drawSpawnDebug(sceneFrameCache.vp);
   updateObjectHighlight(sceneFrameCache.vp);
  }
  return false;
 }

 const stamp = openMenu
  ? state.r + ':' + state.d + ':' + spawnLevel() + ':' + state.spawnInspector + ':' +
    state.cargo.length + ':' + state.depot.length + ':' + depotPending.size + ':' +
    viewYaw + ':' + viewElevation + ':' + viewDistance + ':' + W + ':' + H
  : '';
 if (gl.isSoftware && stamp && stamp === pausedRenderStamp && !sceneMotionActive && !saleGhosts.length) {
  return false;
 }

 pausedRenderStamp = stamp;
 render();
 return true;
}

function frame(now) {
 if (!gameLoading.ready) return;

 let rendered = false;
 if (allowSceneFrame(now)) {
  advanceGameSimulation(now);
  rendered = drawGameFrame(now);
 }
 recordFpsFrame(now, rendered);
 requestAnimationFrame(frame);
}
