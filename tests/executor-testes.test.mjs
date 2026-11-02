import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {selecionarTestes} from '../scripts/verificar.mjs';
import {ROOT} from '../scripts/compilar.mjs';

const todos=['jogo.test.mjs','carregamento.test.mjs','pages.test.mjs'];

test('executor mantém toda a suíte por padrão, inclusive com --sem-pausa',()=>{
 for(const args of [[],['--sem-pausa']]){
  assert.deepEqual(selecionarTestes(todos,args).files,todos.map(file=>'tests/'+file));
 }
});

test('seleção exata aceita nome ou tests/nome e remove apenas repetições solicitadas',()=>{
 const result=selecionarTestes(todos,['--arquivo','pages.test.mjs','--arquivo',
  'tests/jogo.test.mjs','--arquivo','tests/pages.test.mjs','--listar','--sem-pausa']);
 assert.deepEqual(result.files,['tests/pages.test.mjs','tests/jogo.test.mjs']);
 assert.equal(result.listar,true);
 assert.equal(result.ajuda,false);
 assert.deepEqual(selecionarTestes(['jogo.test.mjs','jogo.test.mjs'],[]).files,
  ['tests/jogo.test.mjs','tests/jogo.test.mjs'],'o padrão não filtra a lista fornecida');
});

test('executor rejeita nomes desconhecidos, seleção vazia, traversal e opções inválidas',()=>{
 for(const args of [
  ['--arquivo','desconhecido.test.mjs'],['--arquivo'],['--arquivo','--listar'],
  ['--arquivo','../jogo.test.mjs'],['--arquivo','tests/../jogo.test.mjs'],
  ['--arquivo','tests\\jogo.test.mjs'],['--arquivo','*.test.mjs'],['--arquiv'],['jogo.test.mjs']
 ])assert.throws(()=>selecionarTestes(todos,args),Error,JSON.stringify(args));
 assert.throws(()=>selecionarTestes([],[]),/Nenhum teste/);
 assert.equal(selecionarTestes(todos,['--help']).ajuda,true);
});

test('CLI --listar seleciona sem gerar distribuição ou executar o jogo',()=>{
 // Other test files regenerate dist concurrently. An isolated fixture observes
 // the actual CLI without racing their writes or booting the full game.
 const directory=path.join(ROOT,'tests/resultados');fs.mkdirSync(directory,{recursive:true});
 const fixture=fs.mkdtempSync(path.join(directory,'executor-listar-'));
 const files=['scripts/verificar.mjs','scripts/compilar.mjs','tests/pages.test.mjs','build-called','test-called'];
 fs.mkdirSync(path.join(fixture,'scripts'));fs.mkdirSync(path.join(fixture,'tests'));
 try{
  fs.copyFileSync(path.join(ROOT,'scripts/verificar.mjs'),path.join(fixture,files[0]));
  fs.writeFileSync(path.join(fixture,files[1]),`import fs from 'node:fs';
   export const ROOT=${JSON.stringify(fixture)};
   export function build(){fs.writeFileSync(new URL('../build-called',import.meta.url),'');throw Error('build não deveria executar');}`);
  fs.writeFileSync(path.join(fixture,files[2]),`import fs from 'node:fs';
   fs.writeFileSync(new URL('../test-called',import.meta.url),'');`);
  const result=spawnSync(process.execPath,[path.join(fixture,files[0]),
   '--arquivo','pages.test.mjs','--listar'],{cwd:fixture,encoding:'utf8',windowsHide:true,timeout:10000});
  assert.equal(result.status,0,result.stderr);
  assert.equal(result.stdout.trim(),'tests/pages.test.mjs');
  assert.equal(result.stderr,'');
  assert.equal(fs.existsSync(path.join(fixture,'build-called')),false);
  assert.equal(fs.existsSync(path.join(fixture,'test-called')),false);
 }finally{
  for(const file of files)if(fs.existsSync(path.join(fixture,file)))fs.unlinkSync(path.join(fixture,file));
  fs.rmdirSync(path.join(fixture,'scripts'));fs.rmdirSync(path.join(fixture,'tests'));fs.rmdirSync(fixture);
 }
});
