// Preload only in a disposable checkout, during separate profiling runs.
import fs from 'node:fs';
import zlib from 'node:zlib';
import path from 'node:path';
import {syncBuiltinESMExports} from 'node:module';
import {performance} from 'node:perf_hooks';
import assert from 'node:assert/strict';
const rows=[],assertions={},root=process.cwd(),write=fs.writeFileSync.bind(fs);
for(const name of ['equal','deepEqual','notEqual','notDeepEqual','ok','match','doesNotMatch','throws']){
 const original=assert[name];
 assert[name]=function(...args){const began=performance.now();try{return original(...args)}finally{
  const record=assertions[name]??={count:0,ms:0};record.count++;record.ms+=performance.now()-began;
 }};
}
for(const name of ['readFileSync','writeFileSync']){
 const original=fs[name].bind(fs);
 fs[name]=function(...args){const began=performance.now();let result;
  try{return result=original(...args)}finally{
   const file=typeof args[0]==='string'?path.relative(root,args[0]):String(args[0]);
   rows.push({operation:name,file,ms:performance.now()-began,bytes:typeof result==='string'?Buffer.byteLength(result):result?.byteLength??args[1]?.byteLength??null});
  }
 };
}
const deflate=zlib.deflateSync.bind(zlib);
zlib.deflateSync=function(...args){const began=performance.now();try{return deflate(...args)}finally{rows.push({operation:'deflateSync',ms:performance.now()-began,bytes:args[0]?.byteLength})}};
syncBuiltinESMExports();
process.on('exit',()=>write(process.env.VORA_AUDIT_IO_OUTPUT,JSON.stringify({environment:'Instrumented CPU I/O and host assertions; not browser transfer',assertions,rows},null,2)+'\n'));
