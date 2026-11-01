// Disposable experiment: exact-coordinate memoization, cleared every lattice row.
// The lattice, thresholds, binary-search iterations, ordering and yields stay intact.
export function memoizedWalkways(source){
 const start=source.indexOf(' const clip=(poly,threshold,above)=>');
 const end=source.indexOf(' walkMeshStats=',start);
 if(start<0||end<0)throw Error('Walkway prototype anchors not found');
 const helper=` const auditFieldCache=new Map();
 const auditSampleField=(x,z)=>{const key=x+','+z;if(auditFieldCache.has(key))return auditFieldCache.get(key);const value=walkFieldAt(x,z);auditFieldCache.set(key,value);return value};
`;
 let body=source.slice(start,end).replaceAll('walkFieldAt(', 'auditSampleField(');
 const needle='  if (++processedCells % 4 === 0)';
 if(!body.includes(needle))throw Error('Walkway row anchor not found');
 body=body.replace(needle,'  if(i===0)auditFieldCache.clear();\n'+needle);
 return source.slice(0,start)+helper+body+source.slice(end);
}
