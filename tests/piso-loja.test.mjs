import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
test('fundação substitui a calçada coplanar apenas dentro da loja',()=>{
 const g=createRuntime(assemble().html);
 assert.equal(g.run('walkSurfaceVisibleAt(base.x,base.y,STATION.deck)'),false);
 assert.equal(g.run('walkSurfaceVisibleAt(base.x+100,base.y,STATION.deck)'),true);
 assert.equal(g.run('walkSurfaceVisibleAt(base.x,base.y,STATION.deck+10)'),true);
 assert.match(g.run('fragmentSource'),/u_material==13\.&&stationDistance\(v_world.xz\)<-\.1/);
});
