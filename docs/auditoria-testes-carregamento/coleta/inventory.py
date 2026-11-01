import pathlib, re, json, hashlib, platform, subprocess, datetime, sys
repo, out = map(pathlib.Path,sys.argv[1:]); out.mkdir(parents=True,exist_ok=True)
items=[]
for file in sorted((repo/'tests').glob('*.test.mjs')):
    text=file.read_text(); lines=text.splitlines()
    items.append({'file':str(file.relative_to(repo)),'lines':len(lines),
        'tests':[{'line':i,'text':line.strip()} for i,line in enumerate(lines,1) if re.search(r'\btest\s*\(',line)],
        'runtimeSites':[{'line':i,'text':line.strip()} for i,line in enumerate(lines,1) if 'createRuntime(' in line],
        'assertions':dict((key,len(re.findall(r'assert\.'+key+r'\(',text))) for key in ['equal','deepEqual','ok','match','notEqual','throws','doesNotMatch']),
        'sourceTransformations':[{'line':i,'text':line.strip()} for i,line in enumerate(lines,1) if re.search(r'replace(?:All)?\(|\.toString\(',line)],
        'readHtml': 'read(' in text,'assembleHtml':'assemble(' in text})
(out/'inventory.json').write_text(json.dumps(items,indent=2,ensure_ascii=False)+'\n')
def cmd(args):
    p=subprocess.run(args,capture_output=True,text=True,cwd=repo);return {'command':args,'exitCode':p.returncode,'stdout':p.stdout,'stderr':p.stderr}
env={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commit':cmd(['git','rev-parse','HEAD']),
     'system':cmd(['uname','-a']),'cpu':cmd(['lscpu']),'memory':cmd(['free','-b']),
     'node':cmd(['node','--version']),'chromiumInstalled':cmd(['chromium','--version']),
     'gpuPci':cmd(['lspci']),'gpuDriver':cmd(['nvidia-smi','--query-gpu=name,driver_version,memory.total','--format=csv,noheader']),
     'governor':cmd(['cat','/sys/devices/system/cpu/cpu0/cpufreq/scaling_governor']),
     'browserMeasurement':{'availableSurface':'IAB read-only DOM inspection','disposableProfileAPI':False,'fileAccess':'Previously denied by URL policy; no bypass attempted','browserTimings':None,'gpuExecution':None}}
(out/'environment.json').write_text(json.dumps(env,indent=2)+'\n')
files={}
for folder in ['src','assets','scripts','tests','backup','dist']:
    for file in sorted((repo/folder).rglob('*')):
        if file.is_file() and 'resultados' not in file.parts: files[str(file.relative_to(repo))]=hashlib.sha256(file.read_bytes()).hexdigest()
(out/'reference-hashes.json').write_text(json.dumps(files,indent=2)+'\n')
for row in items:
    print(row['file'],len(row['tests']),'tests,',len(row['runtimeSites']),'runtime sites:', '; '.join(t['text'].split('=>')[0] for t in row['tests']))
