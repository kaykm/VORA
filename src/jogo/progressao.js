// Economy v2 keeps classic integer item IDs and adds immutable lot measurements
// to the canonical save. Old cargo/depot quotes survive migration unchanged.
const LEGACY_ITEM_PRICES=[8,12,30,52,48];
const EXTRA_UPGRADES={
 storage:{name:'Organização da carga',page:'hole',max:8,base:160,growth:1.42,description:'Mais 25% de capacidade por nível.'},
 compression:{name:'Compactação de materiais',page:'hole',max:8,base:220,growth:1.46,description:'Reduz o volume dos próximos materiais coletados.'},
 regrowth:{name:'Reposição dos pontos',page:'spawns',max:8,base:180,growth:1.43,description:'Reduz em 5% por nível a espera dos pontos fixos.'},
 trade:{name:'Negociação',page:'sales',max:8,base:240,growth:1.48,description:'Mais 8% no valor de todas as vendas por nível.'},
 unloading:{name:'Descarga rápida',page:'sales',max:6,base:140,growth:1.4,description:'Acelera a transferência dos materiais para a caixa.'},
 returning:{name:'Rota de retorno',page:'speed',max:6,base:130,growth:1.4,description:'Mais 12% de velocidade ao voltar automaticamente à base.'}
};
function extraLevel(key){const n=state.upgrades?.[key];return Number.isInteger(n)?Math.max(0,Math.min(EXTRA_UPGRADES[key]?.max||0,n)):0;}
function extraCost(key){const d=EXTRA_UPGRADES[key];return Math.round(d.base*d.growth**extraLevel(key));}
function tradeMultiplier(){return 1+extraLevel('trade')*.08;}
function compressionMultiplier(){return 1/(1+extraLevel('compression')*.18);}
function regrowthMultiplier(level=spawnLevel()){return (1-level*.05)*(1-extraLevel('regrowth')*.05);}
function unloadingDuration(){return .9/(1+extraLevel('unloading')*.2);}
function lotMeta(t,record,legacy=false){
 if(record?.t!==undefined&&record.t!==t)record=null;
 const volumeML=Number.isInteger(record?.volumeML)&&record.volumeML>0&&record.volumeML<=5000000?record.volumeML:ASSET_METRICS[t].loadDL*100;
 const valueCents=Number.isInteger(record?.valueCents)&&record.valueCents>=0&&record.valueCents<=100000000?record.valueCents:Math.round((legacy?LEGACY_ITEM_PRICES[t]:TYPES[t].price)*100);
 return {t,volumeML,valueCents};
}
function initProgression(){
 const legacy=state.economyVersion!==2;
 state.cargoMeta=state.cargo.map((t,i)=>lotMeta(t,state.cargoMeta?.[i],legacy));
 if(Array.isArray(state.depot))state.depot=state.depot.filter(e=>e&&TYPES[e.t]).map(e=>({...e,...lotMeta(e.t,e,legacy)}));
 state.upgrades=Object.fromEntries(Object.keys(EXTRA_UPGRADES).map(key=>[key,extraLevel(key)]));
 state.economyVersion=2;
}
function cargoMetaAt(i){return lotMeta(state.cargo[i],state.cargoMeta?.[i]);}
function cargoUsedML(){return state.cargo.reduce((sum,t,i)=>sum+cargoMetaAt(i).volumeML,0);}
function cargoValue(){return Math.round(state.cargo.reduce((sum,t,i)=>sum+cargoMetaAt(i).valueCents,0)*tradeMultiplier())/100;}
function cargoCanFit(o){return !cargoRimFull()&&state.cargo.length<399&&cargoUsedML()+pickupVolumeML(o)<=Math.round(capacity()*1000);}
function pickupVolumeML(o){return o.worldProp?Math.max(10,Math.round(o.resourceVolumeML*compressionMultiplier())):ASSET_METRICS[o.t].loadDL*100;}
function pickupBaseCents(o){return o.worldProp?o.resourceValueCents:Math.round(TYPES[o.t].price*100);}
function pickupPrice(o){return Math.round(pickupBaseCents(o)*tradeMultiplier())/100;}
function appendCargoLot(t,meta){
 state.cargoMeta=state.cargo.map((type,i)=>lotMeta(type,state.cargoMeta?.[i]));
 state.cargo.push(t);state.cargoMeta.push(lotMeta(t,meta));
}
function resourceYield(o){
 const p=o.worldProp,[w,h,d]=resourceDimensions(p).map(v=>v/WORLD_UNITS_PER_METER);
 let solidLiters;
 if(p.type==='tree')solidLiters=Math.PI*Math.max(.025,h*.035)**2*h*1000;
 else solidLiters=w*h*d*1000*(p.kind==='boulder'?.5:p.type==='bench'||p.kind==='picnic'?.12:p.kind==='gardenpot'?.18:.32);
 const liters=Math.max(.01,.16*Math.pow(solidLiters,.64));
 const bonus=p.type==='tree'?h*3:p.type==='bench'?15:p.kind==='picnic'?25:0;
 return {volumeML:Math.max(10,Math.round(liters*1000)),valueCents:Math.max(1,Math.round((liters*[6,5,4,7,6][o.t]+bonus)*100))};
}
function resourceDimensions(p){
 if(p.type==='tree'){
  const m=getModelMesh('tree',p.p[3]??Math.floor(materialHash(p.p[0],p.p[1])*6),0),s=p.p[2]/m.bounds.max[1];
  return m.bounds.max.map((v,i)=>(v-m.bounds.min[i])*s);
 }
 if(p.type==='bench')return BENCH_METRICS.dimensions.map(meters);
 const m=parkPropMeshes.get(p.kind+':'+(p.variant||0));
 return m.bounds.max.map((v,i)=>(v-m.bounds.min[i])*(p.visualScale||1)*(p.stretch?.[i]||1));
}
function buyExtraUpgrade(key){
 if(!Object.prototype.hasOwnProperty.call(EXTRA_UPGRADES,key))return false;
 const d=EXTRA_UPGRADES[key];if(extraLevel(key)>=d.max||(!state.developer&&state.coins<extraCost(key)))return false;
 const before=regrowthMultiplier();if(!state.developer)state.coins-=extraCost(key);
 state.upgrades??={};state.upgrades[key]=extraLevel(key)+1;
 if(key==='regrowth')rescaleSpawnTimers(regrowthMultiplier()/before);
 updateUI();persist();sound(720);toast(d.name+' · nível '+extraLevel(key));return true;
}
