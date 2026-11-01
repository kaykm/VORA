// Keyboard events stay inside the game document; the parent chat owns its own focus.
function gameKey(e){
const codes={KeyW:'w',KeyA:'a',KeyS:'s',KeyD:'d',KeyE:'e',ArrowUp:'arrowup',ArrowDown:'arrowdown',ArrowLeft:'arrowleft',ArrowRight:'arrowright'};
const key=codes[e.code]||(e.key||'').toLowerCase();
return ['w','a','s','d','e','arrowup','arrowdown','arrowleft','arrowright'].includes(key)?key:null;
}
function editableGameTarget(target){return !!target&&(target.isContentEditable||!!target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))}
function clearGameInput(){keys={};joy={x:0,y:0};$('stick').style.transform=''}
function focusGameScene(){
if(gameLoading.active||document.hidden||openMenu||editableGameTarget(document.activeElement))return;
canvas.focus({preventScroll:true});
}
function initGameInput(){
// Hover is intentional entry into the scene. No polling or refocusing while typing in chat.
canvas.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'&&!e.buttons)focusGameScene()});
canvas.addEventListener('pointerdown',focusGameScene,{capture:true});
$('joystick').addEventListener('pointerdown',focusGameScene,{capture:true});
window.addEventListener('keydown',e=>{
if(gameLoading.active||e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||openMenu||document.querySelector('dialog[open]')||editableGameTarget(e.target)||e.target?.closest?.("#insidePanel"))return;
const k=gameKey(e);if(!k)return;
e.preventDefault();e.stopPropagation();keys[k]=true;
if(k==='e'&&!e.repeat)sell();
},{capture:true});
window.addEventListener('keyup',e=>{const k=gameKey(e);if(!k)return;const held=keys[k];delete keys[k];if(held){e.preventDefault();e.stopPropagation()}},{capture:true});
canvas.addEventListener('blur',clearGameInput);
window.addEventListener('blur',clearGameInput);
document.addEventListener('visibilitychange',()=>{clearGameInput();last=performance.now()});
// In a standalone tab the document already owns focus. An embedded preview may not.
requestAnimationFrame(()=>{if(document.hasFocus?.()&&(document.activeElement===document.body||document.activeElement===document.documentElement))focusGameScene()});
}

