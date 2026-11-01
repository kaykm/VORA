"""Create only disposable copies; never patch the supplied source checkout."""
import pathlib, subprocess, tarfile, io, sys, difflib
repo=pathlib.Path(sys.argv[1]); target=pathlib.Path(sys.argv[2]);target.mkdir(parents=True,exist_ok=True)
archive=subprocess.check_output(['git','archive','HEAD'],cwd=repo)
def clone(name):
    dest=target/name
    if dest.exists(): raise RuntimeError(f'Refusing to overwrite {dest}')
    dest.mkdir()
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar: tar.extractall(dest,filter='data')
    return dest
def patch(dest,name,old,new):
    file=dest/name; source=file.read_text()
    if old not in source: raise RuntimeError(f'Patch not applicable: {name}')
    result=source.replace(old,new,1);file.write_text(result)
    delta=''.join(difflib.unified_diff(source.splitlines(True),result.splitlines(True),fromfile='a/'+name,tofile='b/'+name))
    (target/(dest.name+'.patch')).write_text(delta)
cached=clone('cached')
patch(cached,'tests/ambiente.mjs',"export function createRuntime(html,save=null,{", "const auditScripts=new Map();\nexport function createRuntime(html,save=null,{")
file=cached/'tests/ambiente.mjs'; source=file.read_text(); source=source.replace(" vm.runInContext(js,context,{timeout:45000,filename:'VORA.js'});", " let auditScript=auditScripts.get(js);if(!auditScript){auditScript=new vm.Script(js,{filename:'VORA.js'});auditScripts.set(js,auditScript)}auditScript.runInContext(context,{timeout:45000});")
file.write_text(source)
original=(repo/'tests/ambiente.mjs').read_text();(target/'cached.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),source.splitlines(True),fromfile='a/tests/ambiente.mjs',tofile='b/tests/ambiente.mjs')))
minimal=clone('minimal')
patch(minimal,'tests/piso-loja.test.mjs','const g=createRuntime(assemble().html);',"const g=createRuntime(assemble().html,null,{boot:'manual'});")
profile=clone('profile')
file=profile/'tests/ambiente.mjs';source=(repo/'tests/ambiente.mjs').read_text()
source=source.replace("import vm from 'node:vm';", "import vm from 'node:vm';\nimport fs from 'node:fs';")
source=source.replace('export function createRuntime(', 'function actualRuntime(')
source=source.replace(' const win=new Events(),',' const auditDomMs=performance.now()-began;\n const win=new Events(),')
source=source.replace(" vm.runInContext(js,context,{timeout:45000,filename:'VORA.js'});",' const auditCompileStart=performance.now(),auditScript=new vm.Script(js,{filename:"VORA.js"}),auditCompileMs=performance.now()-auditCompileStart,auditEvalStart=performance.now();auditScript.runInContext(context,{timeout:45000});const auditEvalMs=performance.now()-auditEvalStart;')
source=source.replace(' const run=(code,timeout=45000)=>vm.runInContext(code,context,{timeout});', ''' const auditRunStats={calls:0,ms:0,queries:{}};
 const run=(code,timeout=45000)=>{const began=performance.now();try{return vm.runInContext(code,context,{timeout})}finally{
  auditRunStats.calls++;auditRunStats.ms+=performance.now()-began;const key=code.length<90?code:'(long code)';auditRunStats.queries[key]=(auditRunStats.queries[key]||0)+1;
 }};''')
source=source.replace(' return {context,doc,store,',' return {auditRunStats,auditDomMs,auditCompileMs,auditEvalMs,context,doc,store,')
source+='''
const auditRuntimeRecords=[];
process.on('exit',()=>fs.appendFileSync(process.env.VORA_AUDIT_RUNTIME_LOG,auditRuntimeRecords.map(r=>JSON.stringify(r)+'\\n').join('')));
export function createRuntime(...args){
 const began=performance.now(),stack=new Error().stack;let g;
 try{return g=actualRuntime(...args)}finally{
  const record={pid:process.pid,stack,success:!!g,elapsedMs:performance.now()-began,boot:args[2]?.boot||'auto',hasSave:!!args[1],
   startupMs:g?.startupMs,domSetupMs:g?.auditDomMs,compileMs:g?.auditCompileMs,evaluateMs:g?.auditEvalMs,
   incremental:g?.incrementalBoot,steps:g?.bootSteps.length,bootWorkMs:g?.bootSteps.reduce((sum,s)=>sum+s.ms,0),
   maxStepMs:g?.bootSteps.reduce((max,s)=>Math.max(max,s.ms),0),rssBytes:process.memoryUsage().rss,runStats:g?.auditRunStats};
  auditRuntimeRecords.push(record);
 }
}
'''
file.write_text(source)
original=(repo/'tests/ambiente.mjs').read_text()
(target/'profile.patch').write_text(''.join(difflib.unified_diff(original.splitlines(True),source.splitlines(True),fromfile='a/tests/ambiente.mjs',tofile='b/tests/ambiente.mjs')))
for dest in [cached,minimal,profile]: subprocess.run(['node','scripts/gerar.mjs'],cwd=dest,check=True)
