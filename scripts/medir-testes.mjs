// Mede o executor oficial sem alterar concorrência, cenários ou asserções.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';

const ROOT=path.resolve(import.meta.dirname,'..');
const help=`Uso: node scripts/medir-testes.mjs --saida <nome> [--vezes <N>]
Executa scripts/verificar.mjs, incluindo a geração, com concorrência oficial 2.
Grava tests/resultados/<nome>.json e .log; recusa sobrescrever arquivos.
Cada rodada usa um processo novo; nenhuma amostra ou outlier é descartado.
Tempo de parede inclui geração, testes e inicialização dos processos.
Não mede GPU, FPS nem o carregamento real de um navegador.`;

function options(args){
 const result={name:null,times:1};
 for(let i=0;i<args.length;i++){
  if(args[i]==='--help'||args[i]==='-h')return null;
  if(args[i]==='--saida')result.name=args[++i];
  else if(args[i]==='--vezes')result.times=Number(args[++i]);
  else throw Error('Argumento desconhecido: '+args[i]);
 }
 if(!result.name||!/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(result.name))
  throw Error('--saida exige um nome simples, sem diretórios.');
 if(!Number.isInteger(result.times)||result.times<1||result.times>100)
  throw Error('--vezes deve ser um inteiro entre 1 e 100.');
 return result;
}

function git(args){
 const result=spawnSync('git',args,{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:5000});
 return result.status===0?result.stdout.trim():null;
}

function summary(output){
 const clean=output.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g,'');
 const get=(key)=>{
  const matches=[...clean.matchAll(new RegExp('^\\s*(?:#|ℹ)?\\s*'+key+'\\s+([0-9.]+)\\s*$','gm'))];
  return matches.length?Number(matches.at(-1)[1]):null;
 };
 return {tests:get('tests'),pass:get('pass'),fail:get('fail'),cancelled:get('cancelled'),
  skipped:get('skipped'),todo:get('todo'),nodeDurationMs:get('duration_ms')};
}

try{
 const config=options(process.argv.slice(2));
 if(!config){console.log(help);process.exit(0);}
 const directory=path.join(ROOT,'tests/resultados');
 fs.mkdirSync(directory,{recursive:true});
 const logFile=path.join(directory,config.name+'.log');
 const jsonFile=path.join(directory,config.name+'.json');
 if(fs.existsSync(logFile)||fs.existsSync(jsonFile))throw Error('Já existe resultado com esse nome: '+config.name);
 const log=fs.openSync(logFile,'wx');
 const json=fs.openSync(jsonFile,'wx');
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,file))).digest('hex');
 const command=process.platform==='win32'?
  [process.env.ComSpec||'cmd.exe','/d','/c','verificar.cmd','--sem-pausa']:
  [process.execPath,'scripts/verificar.mjs'];
 const report={schemaVersion:1,createdAt:new Date().toISOString(),
  scope:'Suíte oficial em Node/DOM simulado/SoftwareGL; não mede navegador ou GPU.',
  command,concurrency:2,
  gitHead:git(['rev-parse','HEAD']),gitStatus:git(['status','--short']),
  harnessSha256:hash('tests/ambiente.mjs'),runnerSha256:hash('scripts/verificar.mjs'),
  environment:{node:process.version,v8:process.versions.v8,platform:process.platform,arch:process.arch,
   cpu:os.cpus()[0]?.model??null,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem()},
  samples:[],completed:false,allPassed:false};
 const save=()=>{fs.ftruncateSync(json,0);fs.writeSync(json,JSON.stringify(report,null,2)+'\n',0,'utf8');};
 try{
  save();
  for(let i=0;i<config.times;i++){
   console.log('Medição '+(i+1)+'/'+config.times+': executor oficial; saída em '+path.relative(ROOT,logFile));
   fs.writeSync(log,'\n=== RODADA '+(i+1)+' ===\n',null,'utf8');
   const offset=fs.fstatSync(log).size;
   const startedAt=new Date().toISOString(),start=performance.now();
   const result=spawnSync(command[0],command.slice(1),{cwd:ROOT,
    stdio:['ignore',log,log],windowsHide:true,
    env:{...process.env,NO_COLOR:'1',NODE_DISABLE_COLORS:'1'}});
   const wallMs=performance.now()-start;
   const data=fs.readFileSync(logFile).subarray(offset).toString('utf8');
   const totals=summary(data);
   const passed=result.status===0&&totals.tests>0&&totals.fail===0&&totals.cancelled===0;
   report.samples.push({iteration:i+1,startedAt,wallMs,exitCode:result.status,signal:result.signal,
    error:result.error?.message??null,...totals,passed});
   save();
   console.log('Rodada '+(i+1)+': '+(wallMs/1000).toFixed(3)+' s; saída '+result.status+
    '; '+totals.pass+' aprovados / '+totals.fail+' falhas.');
  }
  report.completed=true;
  report.allPassed=report.samples.every(sample=>sample.passed);
  const sorted=report.samples.map(sample=>sample.wallMs).sort((a,b)=>a-b),middle=Math.floor(sorted.length/2);
  report.wall={minMs:sorted[0],maxMs:sorted.at(-1),medianMs:sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2};
  save();
  process.exitCode=report.allPassed?0:1;
  console.log('Relatório: '+jsonFile);
 }finally{fs.closeSync(log);fs.closeSync(json);}
}catch(error){console.error(error.message);console.error(help);process.exitCode=1;}
