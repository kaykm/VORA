import test from 'node:test';
import assert from 'node:assert/strict';
import {assemble} from '../scripts/compilar.mjs';
import {createRuntime} from './ambiente.mjs';
test('fundação substitui a calçada coplanar apenas dentro da loja',()=>{
 const g=createRuntime(assemble().html,null,{boot:'manual'});
 assert.equal(g.run('walkSurfaceVisibleAt(base.x,base.y,STATION.deck)'),false);
 assert.equal(g.run('walkSurfaceVisibleAt(base.x+100,base.y,STATION.deck)'),true);
 assert.equal(g.run('walkSurfaceVisibleAt(base.x,base.y,STATION.deck+10)'),true);
 assert.equal(g.run('walkSurfaceVisibleAt(base.x,base.y,STATION.deck+.1)'),false,'inclui a tolerância superior');
 assert.equal(g.run('walkSurfaceVisibleAt(base.x,base.y,STATION.deck+.1001)'),true,'preserva superfícies acima da tolerância');
 assert.equal(g.run('walkSurfaceVisibleAt(base.x+STATION.halfX,base.y,STATION.deck)'),true,'preserva a borda da fundação');
 assert.equal(g.run('walkSurfaceVisibleAt(base.x+STATION.halfX-.2,base.y,STATION.deck)'),false,'recorta o interior da borda');
 assert.equal(g.run('walkSurfaceVisibleAt(base.x+STATION.halfX-1,base.y+STATION.halfZ-1,STATION.deck)'),true,'preserva a calçada fora do chanfro');

 // O recorte usa a mesma regra nos passes de cor e sombra, no mesmo ponto de cada passe.
 const fragment=g.run('fragmentSource');
 assert.match(fragment,/bool stationCoversWalkway\(vec3 p\)\{\s*return stationDistance\(p.xz\)<-\.1&&p.y<=5\.280\+\.1;/);
 assert.equal(fragment.match(/if\(u_material==13\.&&stationCoversWalkway\(v_world\)\)discard;/g)?.length,2);
});
