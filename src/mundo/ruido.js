// Reuse angle profiles, shape constants and typed buffers across all surface rows.
// Bounded lattice cache: repeated noise samples reuse the same random lattice values.
const latticeValues=new Float64Array(512*512),latticeReady=new Uint8Array(512*512);
function latticeHash(x,y){if(x< -256||x>=256||y< -256||y>=256)return materialHash(x,y);const i=(x+256)*512+y+256;if(!latticeReady[i]){latticeValues[i]=materialHash(x,y);latticeReady[i]=1}return latticeValues[i]}
function quintic(t){return t*t*t*(t*(t*6-15)+10)}
function coherentNoise(x,y){const X=Math.floor(x),Y=Math.floor(y),u=quintic(x-X),v=quintic(y-Y),A=latticeHash(X,Y),B=latticeHash(X+1,Y),C=latticeHash(X,Y+1),D=latticeHash(X+1,Y+1);return A+(B-A)*u+(C-A)*v+(A-B-C+D)*u*v}
function noiseSample(x,y,out){const X=Math.floor(x),Y=Math.floor(y),fx=x-X,fy=y-Y,u=quintic(fx),v=quintic(fy),dx=30*fx*fx*(fx*(fx-2)+1),dy=30*fy*fy*(fy*(fy-2)+1),A=latticeHash(X,Y),B=latticeHash(X+1,Y),C=latticeHash(X,Y+1),D=latticeHash(X+1,Y+1),cross=A-B-C+D;out[0]=A+(B-A)*u+(C-A)*v+cross*u*v;out[1]=(B-A+cross*v)*dx;out[2]=(C-A+cross*u)*dy;return out}
