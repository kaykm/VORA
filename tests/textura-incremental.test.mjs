import test from 'node:test';
import assert from 'node:assert/strict';
import {read} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';

test('textura procedural parcelada mantém cada byte da versão anterior',()=>{
 const game=createRuntime(read('backup/VORA-original-17.html'));
 game.run(`gl.createTexture=()=>({});gl.activeTexture=()=>{};gl.bindTexture=()=>{};
  gl.texParameteri=()=>{};gl.generateMipmap=()=>{};gl.getExtension=()=>null;
  gl.texImage2D=(...args)=>{globalThis.capturedTurf=args.at(-1)};
  makeTurfTexture();globalThis.originalTurf=capturedTurf;
  function drainGpuPreparation(iterator){let result;while(!(result=iterator.next()).done){}return result.value}
 `);
 const source=read('src/graficos/texturas.js');
 game.run(source.slice(source.indexOf('function makeTurfTexture('),source.indexOf('function makeShadowTarget(')));
 game.run('makeTurfTexture()');
 const expected=game.run('originalTurf'),actual=game.run('capturedTurf');
 assert.deepEqual(Buffer.from(actual),Buffer.from(expected));
});
