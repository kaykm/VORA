// VORA's metric contract. Rendering, pickups, cargo and debug tools share these dimensions.
const WORLD_UNITS_PER_METER=48,WORLD_SCALE_VERSION=2;
const meters=n=>n*WORLD_UNITS_PER_METER;
const HOLE_RADII=[.16,.22,.30,.40,.53,.70,.92,1.20,1.55,1.98,2.50,2.85,3.25,3.70,4.20,4.75,5.35,6.00,6.70,7.45,8.25];
const HOLE_DEPTHS=[.30,.42,.58,.80,1.08,1.44,1.90,2.48,3.20,4.00,4.80,5.70,6.70,7.80,9.00,10.30,11.70,13.20,14.80,16.50,18.30];
const RADIUS_MAX_LEVEL=HOLE_RADII.length-1,DEPTH_MAX_LEVEL=HOLE_DEPTHS.length-1;
// Usable carrying allowance, independent of the whole excavated volume. Kept below 400 cans.
const CARGO_LITERS=[8,12,18,26,36,48,60,72,84,96,108,114,120,126,132,138,142,146,150,153,156];
const ASSET_METRICS=[
 {id:'can',dimensions:[.066,.122,.066],author:[9.07,12.1432053,9.06],floor:.15,loadDL:4,mass:.016,round:true},
 {id:'rock',dimensions:[.18,.11,.15],author:[16.162777,9.3346954,14.5789933],floor:.15,loadDL:16,mass:2.3,round:false},
 {id:'box',dimensions:[.40,.30,.32],author:[32,26.040001,30.53],floor:0,loadDL:384,mass:.65,round:false},
 {id:'pot',dimensions:[.32,.28,.32],author:[33.5,28.1,33.5],floor:.10,loadDL:157,mass:6.5,round:true,foliageHeight:.59},
 {id:'timber',dimensions:[.28,.12,.12],author:[1,1,1],floor:0,loadDL:40,mass:1.4,round:false}
];
for(const a of ASSET_METRICS){
 a.scale=a.dimensions.map((v,i)=>meters(v)/a.author[i]);
 a.bodySize=a.dimensions.map(meters);a.renderHeight=meters(a.foliageHeight||a.dimensions[1]);
 a.footprint=a.round?a.bodySize[0]/2:Math.hypot(a.bodySize[0],a.bodySize[2])/2;
}
const BENCH_METRICS={dimensions:[1.80,.90,.66],scale:[meters(1.80)/57,meters(.90)/44.3152962,meters(.66)/26.2611856]};
const PICKUP_CLEARANCE=meters(.012),SPAWN_CLEARANCE=meters(.20);
const CAMERA_MIN_DISTANCE=meters(1.4),CAMERA_MAX_DISTANCE=2600;
function defaultCameraDistance(){return Math.max(meters(7.0),meters(radius())*5.2,meters(depth())*2.15)}
