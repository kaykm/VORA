// Curved opaque laminae. Shared by field vegetation and the collectible potted plants.
// Every vertex has its own smooth normal; the midrib is a fold, not a flat polygon fan.
function foliageLeaf(builder,base,tip,width,color,detail=1,options={}){
 const dx=tip[0]-base[0],dz=tip[2]-base[2],length=Math.hypot(dx,dz)||.001,left=[-dz/length,0,dx/length],rise=options.rise??width*.28,twist=options.twist??.1,curl=options.curl??width*.1,segments=detail?4:options.cover?3:2;
 const point=(u,v)=>{const wave=Math.sin(Math.PI*u),w=width*Math.pow(Math.max(0,wave),.72)*(1-.18*u),bend=width*.12*Math.sin(u*Math.PI*1.5),y=base[1]+(tip[1]-base[1])*u+rise*wave-curl*u*u+twist*v*w*u;
  return [base[0]+dx*u+left[0]*(v*w+bend),y-w*.14*v*v,base[2]+dz*u+left[2]*(v*w+bend)]};
 const normal=(u,v)=>{const e=.001,a=point(Math.max(0,u-e),v),b=point(Math.min(1,u+e),v),c=point(u,v-e),d=point(u,v+e),U=b.map((q,k)=>q-a[k]),V=d.map((q,k)=>q-c[k]),n=[V[1]*U[2]-V[2]*U[1],V[2]*U[0]-V[0]*U[2],V[0]*U[1]-V[1]*U[0]];if(n[1]<0)for(let k=0;k<3;k++)n[k]*=-1;n[1]=Math.max(n[1],Math.hypot(n[0],n[2])*.25);const l=Math.hypot(...n)||1;return n.map(q=>q/l)};
 const rows=[];for(let j=0;j<=segments;j++){const u=j/segments;rows.push([-1,0,1].map(v=>({p:point(u,v),n:normal(Math.max(.005,Math.min(.995,u)),v),c:modelColor(color,.90+.12*Math.sin(Math.PI*u)+(v===0?.025:0))})))}
 const tri=(a,b,c)=>{const U=b.p.map((q,k)=>q-a.p[k]),V=c.p.map((q,k)=>q-a.p[k]);if(Math.hypot(U[1]*V[2]-U[2]*V[1],U[2]*V[0]-U[0]*V[2],U[0]*V[1]-U[1]*V[0])<1e-9)return;for(const v of [a,b,c])builder.data.push(...v.p,...v.n,v.c[0],v.c[1],v.c[2]+6)};
 for(let j=0;j<segments;j++)for(let k=0;k<2;k++){tri(rows[j][k],rows[j+1][k],rows[j+1][k+1]);tri(rows[j][k],rows[j+1][k+1],rows[j][k+1])}
}

