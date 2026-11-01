function update(dt){tickSceneMotion(dt);tickObjectInspection(dt);if(document.querySelector('dialog[open]')){advanceDepot(dt);return;}const beforeX=player.x,beforeY=player.y;const sx=(keys.d||keys.arrowright?1:0)-(keys.a||keys.arrowleft?1:0)+joy.x,sy=(keys.s||keys.arrowdown?1:0)-(keys.w||keys.arrowup?1:0)+joy.y;if(Math.hypot(sx,sy)>.06){returning=false;const v=movementVector(sx,sy);player.x+=v.x*movementSpeed()*dt;player.y+=v.y*movementSpeed()*dt;player.facing=Math.atan2(v.x,-v.y)}else if(returning){const dx=base.x-player.x,dy=base.y-player.y,l=Math.hypot(dx,dy);if(l<32){returning=false;toast('Na base')}else{player.x+=dx/l*movementSpeed()*(1+extraLevel('returning')*.12)*dt;player.y+=dy/l*movementSpeed()*(1+extraLevel('returning')*.12)*dt;player.facing=Math.atan2(dx,-dy)}}const moveLimit=WORLD_PLAY_HALF-physicalRadius()*1.40;player.x=Math.max(-moveLimit,Math.min(moveLimit,player.x));player.y=Math.max(-moveLimit,Math.min(moveLimit,player.y));travelDistance+=Math.hypot(player.x-beforeX,player.y-beforeY);const follow=1-Math.exp(-dt*6);camera.x+=(player.x-camera.x)*follow;camera.y+=(player.y-camera.y)*follow;blockTimer-=dt;
// Only loose spawns animate their appearance; fixed world resources have no spawnTime.
for(const o of objects)if(o.alive&&o.spawnTime!==undefined&&o.spawnTime<1)o.spawnTime=Math.min(1,o.spawnTime+dt/.38);
const pickupRadius=physicalRadius(),pickupReach=pickupRadius*1.078,minimumReach=meters(.02);
for(const {object:o}of nearbyPickupObjects(player.x,player.y,Math.max(minimumReach,pickupReach))){
 if(!o.alive)continue;
 const dx=o.x-player.x,dz=o.y-player.y,size=pickupSize(o),pickupBound=Math.max(minimumReach,pickupReach-size-PICKUP_CLEARANCE);
 if(dx*dx+dz*dz>=pickupBound*pickupBound)continue;
 const dist=Math.hypot(dx,dz);
 if(dist<Math.max(minimumReach,apertureRadius(Math.atan2(dz,dx))-size-PICKUP_CLEARANCE)){
  if(!canSwallow(o)){if(blockTimer<=0){toast('Objeto grande demais');blockTimer=4}}
  else if(!cargoCanFit(o)){if(blockTimer<=0){toast(cargoRimFull()?'Borda cheia. Descarregue a carga ou aumente a profundidade.':'Carga cheia');blockTimer=4}}
  else collect(o);
 }
}
tickWorldResourceFalls(dt);tickSpawns(dt);tickDepot(dt);stepCargoPhysics(dt,player.x-beforeX,player.y-beforeY);
for(const p of particles){p.life-=dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;p.vz-=120*dt}particles=particles.filter(p=>p.life>0&&p.z>0);updateSell()}
