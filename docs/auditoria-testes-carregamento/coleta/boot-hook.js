globalThis.__auditBoot={phases:{},progressCalls:0,progressDuplicates:0,progressMs:0,steps:0};
{
 const original=loadingPhase;
 loadingPhase=function*(label,weight,iterator){
  const delegate=original(label,weight,iterator),record=__auditBoot.phases[label]??={ms:0,maxMs:0,steps:0};
  let done=false;
  try{for(;;){const began=__profileNow();let result;try{result=delegate.next()}finally{const elapsed=__profileNow()-began;record.ms+=elapsed;record.maxMs=Math.max(record.maxMs,elapsed);record.steps++}
   if(result.done){done=true;return result.value}yield result.value;
  }}finally{if(!done)delegate.return?.()}
 };
 const update=updateLoadingScreen;let previous=null;
 updateLoadingScreen=function(label=gameLoading.phase){
  const key=label+'\x00'+gameLoading.progress;__auditBoot.progressCalls++;
  if(key===previous)__auditBoot.progressDuplicates++;previous=key;
  const began=__profileNow();try{return update(label)}finally{__auditBoot.progressMs+=__profileNow()-began}
 };
}
