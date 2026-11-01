// One active builder limits temporary memory. No geometry is built in draw calls.
const resourceWork = {
 jobs: new Map(), active: null, completed: 0, cancelled: 0,
 maxSliceMs: 0, maxFrameWorkMs: 0, lastError: null
};

function queueResourceWork(key, iteratorFactory, options = {}) {
 const existing = resourceWork.jobs.get(key);
 if (existing) {
  existing.priority = Math.min(existing.priority, options.priority ?? 100);
  return existing;
 }
 const job = {key, factory: iteratorFactory, iterator: null, priority: options.priority ?? 100, ...options};
 resourceWork.jobs.set(key, job);
 return job;
}

function cancelResourceWork(predicate = () => true) {
 for (const [key, job] of resourceWork.jobs) {
  if (!predicate(job)) continue;
  try { job.iterator?.return?.(); } finally {
   resourceWork.jobs.delete(key);
   if (resourceWork.active === job) resourceWork.active = null;
   job.onCancel?.();
   resourceWork.cancelled++;
  }
 }
}

function processResourceWork(budgetMs = 3) {
 const begin = performance.now(), deadline = begin + Math.max(0, budgetMs);
 let steps = 0;
 while (steps < 128 && performance.now() < deadline) {
  let job = resourceWork.active;
  if (!job) {
   for (const candidate of resourceWork.jobs.values()) {
    if (!job || candidate.priority < job.priority) job = candidate;
   }
   if (!job) break;
   resourceWork.active = job;
  }
  if (job.isValid && !job.isValid()) { cancelResourceWork(candidate => candidate === job); continue; }
  try {
   job.iterator ??= typeof job.factory === 'function' ? job.factory() : job.factory;
   const started = performance.now(), result = job.iterator.next();
   resourceWork.maxSliceMs = Math.max(resourceWork.maxSliceMs, performance.now() - started);
   steps++;
   if (result.done) {
    resourceWork.jobs.delete(job.key);
    resourceWork.active = null;
    resourceWork.completed++;
    job.onComplete?.(result.value);
   } else if (result.value?.waiting) break;
  } catch (error) {
   job.iterator?.return?.();
   resourceWork.jobs.delete(job.key);
   resourceWork.active = null;
   resourceWork.lastError = error;
   if (job.onError) job.onError(error); else console.warn('Recurso do cenário indisponível:', error);
  }
 }
 resourceWork.maxFrameWorkMs = Math.max(resourceWork.maxFrameWorkMs, performance.now() - begin);
 if (steps) {
  geometryVAO?.bind(null);
  boundGeometry = null;
  meshUniformState.fill(NaN);
  if (shaderProgram) gl.useProgram(shaderProgram);
 }
 return steps;
}
