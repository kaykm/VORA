import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {assemble,build,read,manifest,ROOT,expand} from '../scripts/compilar.mjs';
import {changedSources,newSources} from './contratos.mjs';
test('geração determinística, sem downloads nem arquivos externos',()=>{
 const a=assemble(),b=assemble();assert.equal(a.html,b.html);
 build();assert.equal(read('dist/VORA.html'),a.html);
 assert.equal((a.html.match(/<script>/g)||[]).length,1);
 assert.doesNotMatch(a.html,/<script[^>]+src=|<link[^>]+href=/i);
 assert.doesNotMatch(a.javascript,/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/);
 assert.ok(a.html.includes('data:font/woff;base64,'));assert.ok(a.html.includes('id="i-vora"'));
});
test('backup íntegro e toda a sequência original de JavaScript coberta uma única vez',()=>{
 const origin=JSON.parse(read('docs/ORIGEM.json'));
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,'backup/VORA-original-17.html'))).digest('hex'),origin.sha256);
 let next=607;for(const item of origin.files){assert.equal(item.originalLines[0],next);next=item.originalLines[1]+1}assert.equal(next,3839);
 const historical=origin.files.map(x=>x.file),historicalSet=new Set(historical);
 assert.deepEqual(historical,manifest.scripts.filter(file=>historicalSet.has(file)));
 for(const file of manifest.scripts)if(!historicalSet.has(file))assert.ok(newSources.has(file),'nova fonte precisa de contrato explícito: '+file);
 for(const file of newSources.keys())assert.ok(manifest.scripts.includes(file),'fonte de carregamento ausente: '+file);
});
test('todos os arquivos de fonte são incluídos; inclusões recusam ciclos e saídas da pasta',()=>{
 const listed=new Set(manifest.scripts);for(const entry of fs.readdirSync(path.join(ROOT,'src'),{recursive:true}))if(entry.endsWith('.js'))assert.ok(listed.has('src/'+entry.replaceAll('\\','/')),entry);
 assert.throws(()=>expand('<!-- @include ../fora -->'),/fora do projeto/);
 assert.throws(()=>expand('<!-- @include src/index.template.html -->',['src/index.template.html']),/circular/);
});
test('lógica extraída permanece textual e shaders locais preservam os valores',()=>{
 const lines=read('backup/VORA-original-17.html').split(/\r?\n/),origin=JSON.parse(read('docs/ORIGEM.json'));
 for(const {file,originalLines:[start,end]} of origin.files){
  const source=read(file);let expected=lines.slice(start-1,end).join('\n')+'\n';if(start===607)expected=expected.replace(/^<script>/,'');
  if(file==='src/jogo/salvamento.js'){
   const defaultLine=" state.imageMode='native';state.aaMode='off';state.outputMode='native';state.aoMode='off';state.nativeDisplayDefaultsV1=true;";
   expected=expected.replace(defaultLine," // Partidas existentes mantêm suas escolhas; os inicializadores validam o suporte.\n if(!validSave(saved)){state.imageMode='native';state.aaMode='off';state.outputMode='native';state.aoMode='off'}\n state.nativeDisplayDefaultsV1=true;");
  }
  if(!source.includes('/* @')&&!changedSources.has(file))assert.equal(source,expected,file);
  if(file==='src/graficos/iluminacao.js')for(const id of ['vs','fs']){
   const original=expected.match(new RegExp('const '+id+'=(`[^`]*`)'))[1];
   if(id==='vs'){
    const generated=expand(source).match(new RegExp('const '+id+'=("(?:\\\\.|[^"\\\\])*")'))[1];
    assert.equal(vm.runInNewContext(generated),vm.runInNewContext(original),id);
   }
  }
 }
 const lookups=JSON.parse(read('assets/smaa/lookup.json'));for(const asset of Object.values(lookups))assert.equal(fs.statSync(path.join(ROOT,asset.data.slice(8))).size,asset.width*asset.height*4);
});
