function cargoPosition(i,t){const a=i*2.39996,reach=Math.max(0,physicalRadius()*.47-TYPES[t].size),k=Math.sqrt(((i%9)+.5)/9);return[Math.cos(a)*reach*k,Math.sin(a)*reach*k]}
const cargoFootprintDirections=Array.from({length:8},(_,k)=>[Math.cos(k/8*Math.PI*2),Math.sin(k/8*Math.PI*2)]);
function cargoSupportHeight(x,z,t,i){let y=cavityHeightAt(x,z);const footprint=TYPES[t].size;for(let k=0;k<8;k++){const p=cargoFootprintDirections[k];y=Math.max(y,cavityHeightAt(x+p[0]*footprint,z+p[1]*footprint))}return y+Math.min(cavityDepth()*.65,Math.floor(i/9)*Math.min(ASSET_METRICS[t].bodySize[1],meters(.30)))+.12}

