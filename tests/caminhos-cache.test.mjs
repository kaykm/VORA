import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
const expected=JSON.parse(read('tests/fixtures/caminhos.json')).native;

test('cache dos caminhos é privado, libera temporários e reconstrói os mesmos buffers após cancelamento e erro',()=>{
 const game=createRuntime(read('dist/VORA.html'),null,{boot:'manual'});
 game.run(`
  gl.isSoftware=false;gl.drawElements=()=>{};gl.ELEMENT_ARRAY_BUFFER=34963;gl.DYNAMIC_DRAW=35048;
  const bufferBindings=new Map();
  gl.createBuffer=()=>({bytes:new Uint8Array(0),deleted:false});
  gl.bindBuffer=(target,buffer)=>bufferBindings.set(target,buffer);
  gl.bufferData=(target,data)=>{bufferBindings.get(target).bytes=typeof data==='number'?new Uint8Array(data):new Uint8Array(data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength))};
  gl.bufferSubData=(target,offset,data)=>bufferBindings.get(target).bytes.set(new Uint8Array(data.buffer,data.byteOffset,data.byteLength),offset);
  gl.deleteBuffer=buffer=>buffer.deleted=true;

  // Observe allocation/cleanup only in this disposable context. No source rewrite.
  const BaseFloat64Array=Float64Array,BaseUint8Array=Uint8Array,numericCaches=[],validCaches=[];
  Float64Array=class extends BaseFloat64Array {
   constructor(...args){super(...args);if(args[0]===4096)numericCaches.push(this)}
  };
  Uint8Array=class extends BaseUint8Array {
   constructor(...args){super(...args);this.clears=0;if(args[0]===4096)validCaches.push(this)}
   fill(value,...args){if(value===0)this.clears++;return super.fill(value,...args)}
  };
  function countPathStep(stages,result){const stage=result.value?.stage;if(stage)stages[stage]=(stages[stage]||0)+1}
  function primePath(){
   const before=validCaches.length,numericBefore=numericCaches.length,work=buildWalkMeshIncremental(),stages={};
   for(let i=0;i<100000;i++){
    const result=work.next();countPathStep(stages,result);
    if(validCaches.length>before&&validCaches[before].some(Boolean))return {work,flags:validCaches[before],arrays:numericCaches.slice(numericBefore),stages};
    if(result.done)break;
   }
   throw Error('O construtor deve produzir consultas de caminhos antes do upload');
  }
  const firstPath=primePath(),firstSize=firstPath.flags.reduce((sum,n)=>sum+n,0),secondPath=primePath();
 `,45000);
 try{
  assert.equal(game.run('firstPath.flags===secondPath.flags'),false,'cada construção possui seus próprios temporários');
  assert.equal(game.run('firstPath.arrays.some(array=>secondPath.arrays.includes(array))'),false);
  assert.equal(game.run('firstPath.flags.reduce((sum,n)=>sum+n,0)'),game.run('firstSize'),'a segunda construção não limpa a primeira');
  game.run('firstPath.work.return()');
  assert.equal(game.run('firstPath.flags.some(Boolean)'),false,'cancelar invalida o cache ainda preenchido');
  assert.equal(game.run('firstPath.arrays.some(array=>array.some(Boolean))'),false,'cancelar também zera as coordenadas e valores');
  assert.equal(game.run('secondPath.flags.some(Boolean)'),true,'cancelar um trabalho preserva o outro');
  game.run('secondPath.work.return()');
  assert.equal(game.run('secondPath.flags.some(Boolean)'),false);

  game.run('const failedPath=primePath();const originalField=walkFieldAt;');
  assert.throws(()=>game.run(`
   walkFieldAt=()=>{throw Error('Falha de campo injetada')};
   try{for(let i=0;i<100000;i++){if(failedPath.work.next().done)break}}
   finally{walkFieldAt=originalField}
  `),/Falha de campo injetada/);
  assert.equal(game.run('failedPath.flags.some(Boolean)'),false,'erro invalida os temporários da construção');
  assert.equal(game.run('failedPath.arrays.some(array=>array.some(Boolean))'),false);

  game.run(`
   const rebuiltPath=primePath();let result;
   do{result=rebuiltPath.work.next();countPathStep(rebuiltPath.stages,result)}while(!result.done);
   globalThis.rebuiltWalk=result.value;
  `,120000);
  assert.equal(game.run('rebuiltPath.flags.some(Boolean)'),false,'a conclusão também invalida o cache');
  assert.equal(game.run('rebuiltPath.arrays.some(array=>array.some(Boolean))'),false);
  assert.equal(game.run('rebuiltPath.arrays.length'),3,'a capacidade de coordenadas e valores é fixa');
  assert.ok(game.run('rebuiltPath.flags.clears')>=290,'temporários são invalidados durante a passagem pelas linhas');
  const mesh=game.run('rebuiltWalk');
  assert.deepEqual({
   count:mesh.count,vertexCount:mesh.vertexCount,byteLength:mesh.byteLength,
   vertices:hash(Buffer.from(mesh.buffer.bytes)),indices:mesh.indexBuffer?hash(Buffer.from(mesh.indexBuffer.bytes)):null,
   ranges:hash(game.json('rebuiltWalk.parts.map(p=>({first:p.first,count:p.count,sphere:p.sphere}))')),
   stats:hash(game.json('walkMeshStats')),stages:game.json('rebuiltPath.stages')
  },expected,'reconstrução conserva bytes, índices, ranges, estatísticas e yields da referência');
 }finally{
  game.run('Float64Array=BaseFloat64Array;Uint8Array=BaseUint8Array');
 }
});
