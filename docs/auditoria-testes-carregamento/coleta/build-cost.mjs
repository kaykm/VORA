import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {spawnSync} from 'node:child_process';
const [repo,out]=process.argv.slice(2),{assemble,build}=await import(pathToFileURL(path.join(repo,'scripts/compilar.mjs')));
const results=[];
for(let i=0;i<20;i++)for(const [name,fn]of [['assemble',assemble],['build',build]]){const began=performance.now();fn();results.push({i,name,ms:performance.now()-began})}
fs.writeFileSync(path.join(out,'build-samples.json'),JSON.stringify(results,null,2)+'\n');
console.log(JSON.stringify(results));
for(const file of ['equivalencia','inspecao','desempenho']){
 const result=spawnSync(process.execPath,['--import',new URL('./io-profile.mjs',import.meta.url).href,'tests/'+file+'.test.mjs'],{
  cwd:repo,encoding:'utf8',env:{...process.env,VORA_AUDIT_IO_OUTPUT:path.join(out,'io-'+file+'.json')}
 });
 fs.writeFileSync(path.join(out,'io-'+file+'.log'),result.stdout+result.stderr);
 if(result.error)throw result.error;if(result.status!==0)throw Error(file+' I/O profile failed: '+result.status);
}
