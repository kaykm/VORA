import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {build,ROOT} from './compilar.mjs';
try{
 build();
 const files=fs.readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs')).map(f=>'tests/'+f);
 if(!files.length)throw new Error('Nenhum teste encontrado');
 const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{cwd:ROOT,stdio:'inherit'});
 if(result.error)throw result.error;process.exitCode=result.status??1;
}catch(error){console.error(error);process.exitCode=1;}
