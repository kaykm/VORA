// Declared before save loading: an interrupted boot must never overwrite a save.
const gameLoading = {
 active: true, ready: false, error: null, completed: 0, total: 1000,
 progress: 0, phase: 'Iniciando o carregamento…', promise: null,
 steps: 0, maxStepMs: 0
};

function updateLoadingScreen(label = gameLoading.phase) {
 gameLoading.phase = label;
 const byId = id => document.getElementById(id);
 const percent = Math.floor(gameLoading.progress);
 if (byId('loadingStatus')) byId('loadingStatus').textContent = label;
 if (byId('loadingPercent')) byId('loadingPercent').textContent = percent + '%';
 byId('loadingProgress')?.setAttribute('aria-valuenow', String(percent));
 byId('loadingProgress')?.style.setProperty('--load-progress', gameLoading.progress / 100);
}

function failVoraLoading(error) {
 gameLoading.error = error instanceof Error ? error : new Error(String(error));
 gameLoading.ready = false;
 gameLoading.active = true;
 gameLoading.progress = Math.min(99, gameLoading.progress);
 try { cancelResourceWork(); } catch (_) { /* The failure may precede the queue. */ }
 const screen = document.getElementById('loadingScreen');
 if (screen) screen.hidden = false;
 document.documentElement.setAttribute('data-loading', 'true');
 const message = document.getElementById('loadingError');
 if (message) {
  message.hidden = false;
  message.textContent = 'Não foi possível preparar o jogo. ' + gameLoading.error.message;
 }
 const retry = document.getElementById('loadingRetry');
 if (retry) { retry.hidden = false; retry.onclick = () => window.location.reload(); }
 updateLoadingScreen('Seu progresso anterior foi preservado.');
 console.error('Falha no carregamento do VORA:', error);
}

// Keep keyboard shortcuts from acting on the world while the overlay owns input.
document.addEventListener('keydown', event => {
 if (!gameLoading.active || event.target?.id === 'loadingRetry') return;
 event.preventDefault();
 event.stopImmediatePropagation?.();
}, {capture: true});
