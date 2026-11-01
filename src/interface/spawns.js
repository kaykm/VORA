function updateSpawnUpgradeUI(){
 const level=spawnLevel(),max=level===SPAWN_MAX_LEVEL;
 $('spawnVal').innerHTML=spawnPointCount()+'<small>pontos fixos</small>';
 $('spawnNext').textContent=max?'Todos os setores liberados':'+ '+(spawnPointCount(level+1)-spawnPointCount())+' pontos no próximo setor';
 $('spawnCost').textContent=max?'MAX':fmt(costS());$('spawnBtn').disabled=max||!state.developer&&state.coins<costS();
}
function syncSpawnDebugUI(){const on=state.spawnInspector===true;$('spawnDebugCanvas').hidden=!on;$('adminBtn').dataset.spawnDebug=String(on)}
function toggleSpawnInspector(){if(state.adminEnabled!==true)return;state.spawnInspector=state.spawnInspector!==true;syncAdminUI();persist()}
function cancelSpawnHold(){if(spawnHold)clearTimeout(spawnHold.timer);spawnHold=null;delete $('settingsBtn').dataset.holding}
function beginSpawnHold(id,x=0,y=0){cancelSpawnHold();const h={id,x,y,fired:false,timer:0};spawnHold=h;$('settingsBtn').dataset.holding='true';h.timer=setTimeout(()=>{if(spawnHold!==h)return;h.fired=true;spawnClickGuard=performance.now()+1500;delete $('settingsBtn').dataset.holding;toggleAdminMode()},2000)}
function endSpawnHold(){if(spawnHold?.fired)spawnClickGuard=performance.now()+1500;cancelSpawnHold()}
function consumeSpawnHoldClick(e){if(performance.now()<spawnClickGuard){spawnClickGuard=0;e?.preventDefault?.();e?.stopPropagation?.();return true}return false}
function initSpawnControls(){
 initAdminControls();
 const b=$('settingsBtn');b.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;beginSpawnHold(e.pointerId,e.clientX,e.clientY);b.setPointerCapture?.(e.pointerId)});
 b.addEventListener('pointermove',e=>{if(spawnHold?.id===e.pointerId&&Math.hypot(e.clientX-spawnHold.x,e.clientY-spawnHold.y)>14)cancelSpawnHold()});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,endSpawnHold);
 b.addEventListener('contextmenu',e=>e.preventDefault());b.addEventListener('keydown',e=>{if(e.code==='Space'&&!e.repeat)beginSpawnHold('keyboard')});b.addEventListener('keyup',e=>{if(e.code==='Space'){if(spawnHold?.fired)e.preventDefault();endSpawnHold()}});
 window.addEventListener('blur',cancelSpawnHold);document.addEventListener('visibilitychange',cancelSpawnHold);syncSpawnDebugUI();
}
function drawSpawnDebug(vp){
 if(state.spawnInspector!==true)return;const canvas=$('spawnDebugCanvas'),ratio=Math.min(devicePixelRatio||1,1.5),key=W+':'+H+':'+ratio;if(key!==spawnDebugSize){spawnDebugSize=key;canvas.width=Math.round(W*ratio);canvas.height=Math.round(H*ratio)}
 const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,W,H);const labels=[];
 const project=(x,z)=>{const y=terrainElevationAt(x,z)+.6,w=vp[3]*x+vp[7]*y+vp[11]*z+vp[15];if(w<=1)return null;return [(vp[0]*x+vp[4]*y+vp[8]*z+vp[12])/w*W*.5+W*.5,H*.5-(vp[1]*x+vp[5]*y+vp[9]*z+vp[13])/w*H*.5]};
 for(const z of spawnZones){const points=z.outline.map(p=>project(...p));if(points.some(p=>!p))continue;const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);if(Math.max(...xs)<0||Math.min(...xs)>W||Math.max(...ys)<0||Math.min(...ys)>H)continue;const color=SPAWN_GROUPS[z.group].color;c.beginPath();points.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.closePath();c.fillStyle=color+(z.active?'12':'05');c.fill();c.strokeStyle=color+(z.active?'c0':'60');c.lineWidth=1.2;c.setLineDash(z.active?[]:[4,5]);c.stroke();c.setLineDash([]);
  for(const o of z.slots){const p=project(o.x,o.y);if(!p)continue;c.beginPath();c.arc(p[0],p[1],o.alive?3:1.6,0,Math.PI*2);c.fillStyle=color+(o.alive?'ee':'55');c.fill()}
  const center=z.slots.length?project(z.slots.reduce((n,o)=>n+o.x,0)/z.slots.length,z.slots.reduce((n,o)=>n+o.y,0)/z.slots.length):points[0];if(!center)continue;let x=Math.max(8,Math.min(W-196,center[0]-94)),y=Math.max(80,Math.min(H-82,center[1]-29));for(let i=0;i<8&&labels.some(r=>Math.abs(r[0]-x)<190&&Math.abs(r[1]-y)<61);i++)y=Math.min(H-82,y+63);labels.push([x,y]);c.fillStyle='#1d241cf2';c.fillRect(x,y,188,57);c.fillStyle=color;c.fillRect(x,y,2,57);c.textAlign='left';c.font='550 10px system-ui';c.fillText(SPAWN_GROUPS[z.group].name+' · '+z.name,x+9,y+15);c.font='10px system-ui';c.fillStyle='#c0c3b1';c.fillText(z.seconds[0]+'–'+z.seconds[1]+' s · máx. '+z.max+' objetos',x+9,y+31);c.fillStyle=z.active?'#e2dccb':'#8d9781';const status=!z.active?'Bloqueado · nível '+z.level:z.count>=z.max?'Lotado · '+z.count+'/'+z.max:z.blocked?'Área ocupada · aguardando':z.count+' ativos · próximo '+(z.remaining??0).toFixed(1).replace('.',',')+' s';c.fillText(status,x+9,y+47);
 }
}

