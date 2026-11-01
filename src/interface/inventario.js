function inventory(){
 const counts=TYPES.map((_,i)=>state.cargo.filter(x=>x===i).length);
 const loads=TYPES.map((_,t)=>state.cargo.reduce((n,x,i)=>n+(x===t?cargoMetaAt(i).volumeML:0),0)/1000);
 const prices=TYPES.map((_,t)=>Math.round(state.cargo.reduce((n,x,i)=>n+(x===t?cargoMetaAt(i).valueCents:0),0)*tradeMultiplier())/100);
 $('inventory').innerHTML=counts.some(Boolean)?counts.map((n,i)=>n?'<div class="inventory-row"><span class="item-icon"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#'+(['i-can','i-rock','i-box','i-pot','i-box'][i])+'"/></svg></span><div class="item-text"><strong>'+TYPES[i].name+'</strong><small>'+n+' un. · '+met(loads[i])+' L</small></div><span class="item-value">'+fmt(prices[i])+'<small>moedas</small></span></div>':'').join(''):'<div class="cargo-empty"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#i-box"/></svg><div><strong>Seu buraco está vazio</strong><p>Passe sobre os objetos do parque<br>para começar a coletar.</p></div></div>';
 $('modalValue').textContent=fmt(depotValue());refreshInterfaceHUD();updateSell();
}
function sell(){sellDepot()}
