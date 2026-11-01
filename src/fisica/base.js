// The entire foundation is permanent solid ground, including its buried faces.
function stationFoundationContact(p){
 const b=p.b,x=player.x+b.lx+p.dx-base.x,z=player.y+b.ly+p.dz-base.y,y=b.z+b.half+p.dy;
 // Convex prism: four straight sides, four clipped corners, top and bottom.
 const dx=Math.abs(x)-STATION.halfX,dz=Math.abs(z)-STATION.halfZ,corner=(Math.abs(x)+Math.abs(z)-STATION.halfX-STATION.halfZ+STATION.chamfer)/Math.SQRT2,top=y-STATION.deck,bottom=-STATION.depth-y;
 let d=dx,nx=x<0?-1:1,ny=0,nz=0;
 if(dz>d){d=dz;nx=0;nz=z<0?-1:1}if(corner>d){d=corner;nx=(x<0?-1:1)/Math.SQRT2;nz=(z<0?-1:1)/Math.SQRT2}
 if(top>d){d=top;nx=nz=0;ny=1}if(bottom>d){d=bottom;nx=nz=0;ny=-1}
 const penetration=p.r-d;if(penetration<=0)return;
 b.contacts++;const push=Math.min(5,Math.max(0,penetration-.025)*.7);b.lx+=nx*push;b.z+=ny*push;b.ly+=nz*push;
 solveImpulse(b,null,p.dx-nx*p.r,p.dy-ny*p.r,p.dz-nz*p.r,0,0,0,nx,ny,nz);
}
function stationBodyContact(p){
 stationFoundationContact(p);
 const b=p.b;
 for(const s of STATION.supports){
  const x=player.x+b.lx+p.dx-base.x-s[0],y=b.z+b.half+p.dy,z=player.y+b.ly+p.dz-base.y-s[1];
  if(Math.abs(x)>s[2]+p.r||Math.abs(z)>s[3]+p.r||y>s[4]+p.r||y<(s[5]??-STATION.depth)-p.r)continue;
  let nx=x-Math.max(-s[2],Math.min(s[2],x)),ny=y-Math.max(s[5]??-STATION.depth,Math.min(s[4],y)),nz=z-Math.max(-s[3],Math.min(s[3],z)),len=Math.hypot(nx,ny,nz),penetration=p.r-len;
  if(penetration<=0)continue;
  if(len<1e-6){const a=s[2]-Math.abs(x),c=s[3]-Math.abs(z),top=s[4]-y;if(top<a&&top<c){ny=1;penetration=p.r+top}else if(a<c){nx=x<0?-1:1;penetration=p.r+a}else{nz=z<0?-1:1;penetration=p.r+c}len=1}
  nx/=len;ny/=len;nz/=len;b.contacts++;const push=Math.min(5,Math.max(0,penetration-.025)*.7);b.lx+=nx*push;b.z+=ny*push;b.ly+=nz*push;
  solveImpulse(b,null,p.dx-nx*p.r,p.dy-ny*p.r,p.dz-nz*p.r,0,0,0,nx,ny,nz);
 }
}

