import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {read} from '../scripts/compilar.mjs';

const loopSource = read('src/jogo/loop.js');
const loadingSource = read('src/jogo/carregamento.js');

// Isola apenas a coordenação: não simula layout, física ou GPU.
function loopRuntime(overrides = {}) {
 const events = [], steps = [], saves = [], scheduled = [], listeners = new Map();
 const fps = {textContent: '—'};
 const context = vm.createContext({
  gameLoading: {ready: true}, state: {showFps: true, r: 0, d: 0, cargo: [], depot: []},
  document: {hidden: false, addEventListener: (name, callback) => listeners.set(name, callback)},
  $: () => fps, gl: {isSoftware: false}, openMenu: null,
  sceneFrameCache: {vp: ['camera'], reusing: false},
  last: 1000, time: 0, cargoPhysicsDirty: false, spawnDirty: false, cargoLastSave: 0,
  insidePinned: true, depotPending: new Set(), viewYaw: 0, viewElevation: 0,
  viewDistance: 1, W: 800, H: 600, pausedRenderStamp: '', sceneMotionActive: false, saleGhosts: [],
  allowSceneFrame: () => true,
  processResourceWork: budget => events.push(['resources', budget]),
  maintainVegetationResources: now => events.push(['vegetation', now]),
  observeImageCadence: elapsed => events.push(['cadence', elapsed]),
  update: dt => { steps.push(dt); events.push(['update']); },
  persist: () => { saves.push(steps.reduce((sum, dt) => sum + dt, 0)); events.push(['save']); },
  drawInside: () => events.push(['inside']),
  shouldRenderSceneFrame: () => true,
  drawSpawnDebug: vp => events.push(['debug', vp]),
  updateObjectHighlight: vp => events.push(['highlight', vp]),
  spawnLevel: () => 1,
  render: () => events.push(['render']),
  requestAnimationFrame: callback => scheduled.push(callback),
  ...overrides
 });
 vm.runInContext(loopSource, context);
 return {context, events, steps, saves, scheduled, listeners, fps};
}

test('loop bloqueado pelo carregamento ou limite de FPS não avança nem salva a partida', () => {
 const loading = loopRuntime({gameLoading: {ready: false}});
 loading.context.frame(2000);
 assert.deepEqual(loading.events, []);
 assert.equal(loading.scheduled.length, 0);

 const limited = loopRuntime({allowSceneFrame: () => false, cargoPhysicsDirty: true});
 limited.context.frame(2000);
 assert.deepEqual(limited.events, []);
 assert.equal(limited.context.last, 1000);
 assert.equal(limited.context.time, 0);
 assert.equal(limited.scheduled.length, 1);
 assert.equal(limited.scheduled[0], limited.context.frame);
});

test('quadro atrasado limita o avanço e salva depois da simulação, antes de apresentar', () => {
 const game = loopRuntime({cargoPhysicsDirty: true});
 game.context.frame(2000);
 assert.ok(game.steps.length > 1);
 assert.ok(game.steps.every(dt => dt > 0 && dt <= 1 / 60));
 assert.ok(Math.abs(game.steps.reduce((sum, dt) => sum + dt, 0) - .1) < 1e-12);
 assert.equal(game.context.time, .1);
 assert.equal(game.context.last, 2000);
 assert.equal(game.context.cargoLastSave, 2000);
 assert.ok(Math.abs(game.saves[0] - .1) < 1e-12, 'o save inclui todos os subpassos');
 const actions = game.events.map(([name]) => name);
 assert.ok(actions.lastIndexOf('update') < actions.indexOf('save'));
 assert.ok(actions.indexOf('save') < actions.indexOf('inside'));
 assert.ok(actions.indexOf('inside') < actions.indexOf('render'));
 assert.equal(game.scheduled.length, 1);
});

test('cena reutilizada continua simulando e atualizando interior e inspeção', () => {
 const game = loopRuntime({shouldRenderSceneFrame: () => false});
 game.context.frame(1020);
 assert.ok(game.steps.length > 0);
 assert.deepEqual(game.events.filter(([name]) => ['inside', 'debug', 'highlight', 'render'].includes(name)), [
  ['inside'], ['debug', game.context.sceneFrameCache.vp], ['highlight', game.context.sceneFrameCache.vp]
 ]);
 assert.equal(game.scheduled.length, 1);
});

test('fallback reutiliza menu estático e redesenha quando câmera, animação ou venda mudam', () => {
 const game = loopRuntime({gl: {isSoftware: true}, openMenu: 'configuracoes'});
 const draws = () => game.events.filter(([name]) => name === 'render').length;
 game.context.frame(1020);
 game.context.frame(1040);
 assert.equal(draws(), 1);
 assert.equal(game.events[0][1], 2, 'o fallback conserva o orçamento da fila');
 game.context.viewYaw = .1;
 game.context.frame(1060);
 assert.equal(draws(), 2);
 game.context.sceneMotionActive = true;
 game.context.frame(1080);
 assert.equal(draws(), 3);
 game.context.sceneMotionActive = false;
 game.context.saleGhosts = [{}];
 game.context.frame(1100);
 assert.equal(draws(), 4);
 assert.equal(game.scheduled.length, 5);
});

test('contador mede somente desenhos e reinicia ao mudar a visibilidade', () => {
 const game = loopRuntime();
 game.context.frame(1000);
 game.context.frame(1300);
 game.context.frame(1600);
 assert.equal(game.fps.textContent, '3');
 game.listeners.get('visibilitychange')();
 assert.equal(game.fps.textContent, '—');
 game.context.sceneFrameCache.reusing = true;
 game.context.frame(2000);
 game.context.frame(2600);
 assert.equal(game.fps.textContent, '—');
});

function loadingRuntime() {
 const context = vm.createContext({
  gameLoading: {completed: 0, progress: 0, total: 1000},
  updateLoadingScreen: () => {}
 });
 vm.runInContext(loadingSource, context);
 return context;
}

test('progresso das fases não recua, limita frações e reserva 100% para a conclusão do boot', () => {
 const context = loadingRuntime();
 function* work() {
  for (const loadingFraction of [-1, .5, .2, 2, NaN]) yield {loadingFraction};
 }
 const phase = context.loadingPhase('Teste', 1000, work()), progress = [];
 for (const step of phase) progress.push(context.gameLoading.progress);
 assert.deepEqual(progress, [0, 50, 50, 99, 99, 99]);
 assert.equal(context.gameLoading.completed, 1000);
});

test('interromper ou falhar uma fase libera o builder sem contabilizar trabalho incompleto', () => {
 for (const fail of [false, true]) {
  const context = loadingRuntime();
  let released = 0;
  const error = new Error('Falha da preparação');
  function* work() {
   try {
    yield {loadingFraction: .5};
    if (fail) throw error;
    yield {loadingFraction: 1};
   } finally {
    released++;
   }
  }
  const phase = context.loadingPhase('Teste', 100, work());
  phase.next();
  if (fail) assert.throws(() => phase.next(), thrown => thrown === error);
  else phase.return();
  assert.equal(released, 1);
  assert.equal(context.gameLoading.completed, 0);
  assert.equal(context.gameLoading.progress, 5);
 }
});
