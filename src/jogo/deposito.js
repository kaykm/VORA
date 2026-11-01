// The depot owns its stock as soon as unloading reserves a slot. Cargo never pays twice.
const DEPOT_CAPACITIES=[64,128,192,272,368,480,608,752],DEPOT_UPGRADE_COST=240;
let depotFlights=[],depotPending=new Set(),depotMesh=null,depotKey='',depotCrates=new Map(),depotBlocked=false;
function initDepot(){state.depotLevel=Number.isInteger(state.depotLevel)?Math.max(1,Math.min(DEPOT_CAPACITIES.length,state.depotLevel)):1;if(!Array.isArray(state.depot))state.depot=[];state.depot=state.depot.filter(e=>e&&Number.isInteger(e.t)&&TYPES[e.t]).map(e=>({t:e.t,variant:Number.isInteger(e.variant)&&e.variant>=0&&e.variant<3?e.variant:0,...lotMeta(e.t,e)}));depotFlights=[];depotPending=new Set();invalidateDepot()}
function depotNear(){return nearBase()||stationDistanceAt(player.x,player.y)<=physicalRadius()+meters(.06)}
function depotCapacity(){return DEPOT_CAPACITIES[(state.depotLevel||1)-1]}
function depotUsed(){return(state.depot||[]).reduce((s,e)=>s+lotMeta(e.t,e).volumeML,0)/1000}
function depotValue(){return Math.round((state.depot||[]).reduce((s,e)=>s+lotMeta(e.t,e).valueCents,0)*tradeMultiplier())/100}
function depotDimensions(){return state.depotLevel>=2?[meters(1.1),meters(.75),meters(.38+(state.depotLevel-2)*.09)]:[meters(.9),meters(.6),meters(.28)]}
function invalidateDepot(){invalidateSceneFrame();if(depotMesh)deleteMesh(depotMesh);depotMesh=null;depotKey=''}
function depotSlots(){const [w,d]=depotDimensions(),gap=meters(.014),margin=meters(.04),result=[];let x=-w/2+margin,z=-d/2+margin,y=0,row=0,layer=0;for(const e of state.depot||[]){const a=ASSET_METRICS[e.t],W=a.bodySize[0],D=a.bodySize[2];if(x+W>w/2-margin+.001){x=-w/2+margin;z+=row+gap;row=0}if(z+D>d/2-margin+.001){x=-w/2+margin;z=-d/2+margin;y+=layer+gap;row=0;layer=0}result.push({x:x+W/2,z:13+z+D/2,y:STATION.deck+meters(.025)+y});x+=W+gap;row=Math.max(row,D);layer=Math.max(layer,a.bodySize[1])}return result}
function unloadDepot(){
 if(!state.cargo.length||stationDistanceAt(player.x,player.y)>physicalRadius()+meters(.06)){depotBlocked=false;return 0}
 ensureCargoBodies();let free=Math.round(depotCapacity()*1000)-Math.round(depotUsed()*1000),moved=0;const remaining=[],remainingMeta=[],bodies=[],starts=[];
 for(let i=0;i<state.cargo.length;i++){const t=state.cargo[i],b=cargoBodies[i],meta=cargoMetaAt(i),size=meta.volumeML;if(size<=free){const index=state.depot.length,e={t,variant:b?.modelVariant??0,...meta};state.depot.push(e);depotPending.add(index);starts.push({index,entry:e,start:[player.x+(b?.lx||0),b?.z??-cavityDepth()*.5,player.y+(b?.ly||0)],q:b?.q.map(v=>v*(b.q[3]<0?-1:1))||[0,0,0,1],half:CARGO_SHAPES[t].half});free-=size;moved++}else{remaining.push(t);remainingMeta.push(meta);if(b){b.cargoIndex=remaining.length-1;bodies.push(b)}}}
 if(moved){state.cargo=remaining;state.cargoMeta=remainingMeta;cargoBodies=bodies;fallingItems=fallingItems.filter(b=>bodies.includes(b));state.cargoPoses=[];const slots=depotSlots();for(const [i,f]of starts.entries()){f.target=slots[f.index];f.time=0;f.delay=Math.min(i,15)*.022;f.visible=i<16;f.matrix=new Float32Array(BODY_IDENTITY);depotFlights.push(f)}if(!motionAllowed()){depotFlights=[];depotPending.clear()}invalidateDepot();cargoPhysicsDirty=true;updateUI();if(openMenu===$('cargoModal'))inventory();persist()}
 if(state.cargo.length&&!depotBlocked){depotBlocked=true;toast('Caixa cheia. Venda para liberar espaço.')}return moved;
}
function advanceDepot(dt){let finished=false;for(const f of depotFlights){f.time+=dt;if(f.time>=f.delay+unloadingDuration()){depotPending.delete(f.index);finished=true}}if(finished){depotFlights=depotFlights.filter(f=>depotPending.has(f.index));invalidateDepot();updateUI()}}
function tickDepot(dt){advanceDepot(dt);unloadDepot()}
function depotUpgradeCost(){return Math.round(DEPOT_UPGRADE_COST*1.48**(state.depotLevel-1));}
function upgradeDepot(){
 if(state.depotLevel>=DEPOT_CAPACITIES.length||(!state.developer&&state.coins<depotUpgradeCost()))return;
 if(!state.developer)state.coins-=depotUpgradeCost();state.depotLevel++;
 invalidateDepot();updateUI();persist();sound(720);toast('Caixa ampliada · '+depotCapacity()+' L');
}
function updateDepotUI(){const b=$('depotUpgradeBtn'),max=state.depotLevel>=DEPOT_CAPACITIES.length;
 $('depotVal').innerHTML=depotCapacity()+'<small>L</small>';
 $('depotNext').textContent='Nível '+state.depotLevel+' / '+DEPOT_CAPACITIES.length+(max?' · Máximo':' → '+DEPOT_CAPACITIES[state.depotLevel]+' L');
 $('depotCost').textContent=max?'MAX':fmt(depotUpgradeCost());b.disabled=max||(!state.developer&&state.coins<depotUpgradeCost());
 b.onclick=()=>{upgradeDepot();placeMenu()};$('depotStatus').textContent='Caixa de vendas · '+met(depotUsed())+' / '+depotCapacity()+' L';$('depotInventory').textContent=TYPES.map((t,i)=>{const n=(state.depot||[]).filter(e=>e.t===i).length;return n?n+' '+(n===1?t.singular:t.name).toLowerCase():''}).filter(Boolean).join(' · ')||'Caixa vazia.';}
let depotSellUIKey='';
function updateDepotSellUI(){const near=depotNear(),v=depotValue(),busy=depotFlights.length>0,key=near+':'+v+':'+busy+':'+returning+':'+!!state.cargo.length;if(key===depotSellUIKey)return;depotSellUIKey=key;$('sellLabel').textContent=returning?'Voltando…':near?(busy?'Descarregando…':v?'Vender · '+fmt(v):'Caixa vazia'):'';$('sellBtn').disabled=near&&(busy||!v);$('sellBtn').dataset.selling=String(near&&v>0);$('sellBtn').dataset.returning=String(returning);$('sellBtn').setAttribute('aria-label',near?'Vender itens da caixa':'Voltar à base');$('modalSell').disabled=near?(busy||!v):!value()&&!v;$('modalSell').textContent=near?(busy?'Descarregando…':'Vender caixa · '+fmt(v)):'Ir à base';$('modalValue').textContent=fmt(v)}
function sellDepot(){if(!depotNear()){returning=true;toast('Voltando à base');return}if(depotFlights.length){toast('Aguarde a descarga');return}const amount=depotValue();if(!amount){unloadDepot();return}const slots=depotSlots();if(motionAllowed())saleGhosts=state.depot.slice(0,8).map((e,i)=>({type:e.t,x:base.x+slots[i].x,z:base.y+slots[i].z,y:slots[i].y,rotation:0,matrix:new Float32Array(BODY_IDENTITY),half:CARGO_SHAPES[e.t].half,modelVariant:e.variant,time:0,delay:i*.035}));state.coins=Math.round((state.coins+amount)*100)/100;state.depot=[];depotPending.clear();invalidateDepot();depotBlocked=false;state.sold++;missionCheck();updateUI();inventory();persist();sound(880);pulseUI('coinsBtn',1.6);toast('+'+fmt(amount)+' moedas');if(openMenu===$('cargoModal'))closeMenu()}
