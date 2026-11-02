import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {build,ROOT} from './compilar.mjs';

const help=`Uso: verificar.cmd [--sem-pausa] [--arquivo nome.test.mjs] [--listar]
     node scripts/verificar.mjs [--arquivo tests/nome.test.mjs] [--listar]
Sem --arquivo: gera o jogo e executa todos os testes, com concorrência 2.
--arquivo pode ser repetido para executar uma seleção exata de arquivos.
--listar mostra a seleção sem gerar o jogo nem executar os testes.
--help mostra esta ajuda. --sem-pausa é tratado pelo comando do Windows.`;

export function selecionarTestes(todos,args){
 const nome=file=>{
  if(typeof file!=='string')throw new Error('Nome de teste inválido');
  const value=file.startsWith('tests/')?file.slice(6):file;
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_.-]*\.test\.mjs$/.test(value))
   throw new Error('Nome de teste inválido: '+file);
  return value;
 };
 const conhecidos=new Map(todos.map(file=>[nome(file),'tests/'+nome(file)]));
 const selecionados=[];
 let listar=false,ajuda=false;
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--sem-pausa')continue;
  if(arg==='--listar'){listar=true;continue;}
  if(arg==='--help'){ajuda=true;continue;}
  if(arg!=='--arquivo')throw new Error('Argumento desconhecido: '+arg);
  const value=args[++i];
  if(value===undefined||value.startsWith('--'))throw new Error('--arquivo exige o nome de um teste');
  const file=conhecidos.get(nome(value));
  if(!file)throw new Error('Teste desconhecido: '+value);
  if(!selecionados.includes(file))selecionados.push(file);
 }
 const files=selecionados.length?selecionados:todos.map(file=>'tests/'+nome(file));
 if(!files.length)throw new Error('Nenhum teste encontrado');
 return {files,listar,ajuda};
}

function main(){
 try{
  const todos=fs.readdirSync(new URL('../tests/',import.meta.url)).filter(f=>f.endsWith('.test.mjs'));
  const {files,listar,ajuda}=selecionarTestes(todos,process.argv.slice(2));
  if(ajuda){console.log(help);return;}
  if(listar){console.log(files.join('\n'));return;}
  build();
  const result=spawnSync(process.execPath,['--test','--test-concurrency=2',...files],{cwd:ROOT,stdio:'inherit'});
  if(result.error)throw result.error;
  process.exitCode=result.status??1;
 }catch(error){console.error(error.message);process.exitCode=1;}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main();
