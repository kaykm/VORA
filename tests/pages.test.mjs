import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {read, ROOT} from '../scripts/compilar.mjs';

test('entrada do Pages abre o jogo dentro do caminho do repositório', () => {
 const entry = read('index.html');
 const refresh = entry.match(/<meta\s+http-equiv="refresh"\s+content="0; url=([^"]+)"/i)?.[1];
 const fallback = entry.match(/<a\s+href="([^"]+)"/i)?.[1];
 assert.ok(refresh, 'a raiz precisa encaminhar o navegador ao HTML do jogo');
 assert.equal(fallback, refresh, 'o link deve funcionar se o redirecionamento estiver desativado');
 for (const site of ['https://kaykm.github.io/VORA/', 'https://exemplo.com/']) {
  const destination = new URL(refresh, site);
  assert.equal(destination.origin, new URL(site).origin);
  assert.equal(destination.pathname, new URL('dist/index.html', site).pathname);
 }
 assert.ok(fs.existsSync(new URL('../dist/index.html', import.meta.url)), 'o destino deve estar na distribuição');
 assert.equal(fs.statSync(ROOT + '/.nojekyll').size, 0, 'o site deve ser servido sem transformação pelo Jekyll');
});
