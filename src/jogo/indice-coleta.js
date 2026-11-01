// Fixed spawn positions make a uniform spatial grid a conservative broad phase.
// Records keep source order: capacity limits must never change who is collected
// first. Alive/animation/size checks still use the canonical objects at query time.
const pickupIndex={source:null,length:0,cellSize:128,cells:new Map(),records:[],candidates:[],queries:0,visited:0};
function invalidatePickupIndex(){pickupIndex.source=null;}
function rebuildPickupIndex(){
 const index=pickupIndex;index.cells.clear();index.records.length=0;
 for(let i=0;i<objects.length;i++){
  const object=objects[i],record={object,order:i};index.records.push(record);
  const key=Math.floor(object.x/index.cellSize)+':'+Math.floor(object.y/index.cellSize);
  let cell=index.cells.get(key);if(!cell)index.cells.set(key,cell=[]);cell.push(record);
 }
 index.source=objects;index.length=objects.length;
}
function nearbyPickupObjects(x,z,radius){
 const index=pickupIndex;if(index.source!==objects||index.length!==objects.length)rebuildPickupIndex();
 const left=Math.floor((x-radius)/index.cellSize),right=Math.floor((x+radius)/index.cellSize);
 const top=Math.floor((z-radius)/index.cellSize),bottom=Math.floor((z+radius)/index.cellSize);
 index.queries++;
 if((right-left+1)*(bottom-top+1)>Math.max(16,index.records.length)){
  index.visited+=index.records.length;return index.records;
 }
 const candidates=index.candidates;candidates.length=0;
 for(let y=top;y<=bottom;y++)for(let X=left;X<=right;X++){
  const cell=index.cells.get(X+':'+y);if(cell)for(const record of cell)candidates.push(record);
 }
 candidates.sort((a,b)=>a.order-b.order);index.visited+=candidates.length;return candidates;
}
