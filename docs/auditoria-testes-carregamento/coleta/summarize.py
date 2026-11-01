import pathlib,json,re,statistics,collections,gzip,sys
d=pathlib.Path(sys.argv[1])
def read(name):return json.loads((d/name).read_text())
def logfile(label):
    file=d/(label+'.log')
    return file if file.exists() else d/(label+'.txt')
def stat(values):
    values=list(values)
    return {'n':len(values),'median':statistics.median(values),'min':min(values),'max':max(values)} if values else None
summary={}
suites=[read(f'suite-{i}.json') for i in range(1,4)]
summary['suite']={k:stat(s[k] for s in suites) for k in ['wallS','userCpuS','systemCpuS','peakSampledTreeRssKiB','maxChildRssKiB']}
files=collections.defaultdict(list)
for s in suites:
    for f in s['files']:files[f['file']].append(f['ms'])
summary['files']=sorted([{'file':name,**stat(values)} for name,values in files.items()],key=lambda r:r['median'],reverse=True)
runtimefile=d/'runtimes.ndjson'
if runtimefile.exists():
    rows=[json.loads(line) for line in runtimefile.read_text().splitlines()]
    groups=collections.defaultdict(list)
    for r in rows:
        name=re.search(r'/tests/([^/]+\.test\.mjs)',r['stack']).group(1);groups[name].append(r)
    def aggregate(rows):
        return {'runtimes':len(rows),'auto':sum(r['boot']=='auto' for r in rows),'manual':sum(r['boot']=='manual' for r in rows),
         'domMs':sum(r.get('domSetupMs',0) for r in rows),'compileMs':sum(r.get('compileMs',0) for r in rows),
         'evaluateMs':sum(r.get('evaluateMs',0) for r in rows),'startupMs':sum(r.get('startupMs',0) for r in rows),
         'bootWorkMsAtConstruction':sum(r.get('bootWorkMs',0) for r in rows),
         'queryCalls':sum(r.get('runStats',{}).get('calls',0) for r in rows),'queryMsInclusive':sum(r.get('runStats',{}).get('ms',0) for r in rows)}
    summary['runtimes']={'total':aggregate(rows),'byFile':{k:aggregate(v) for k,v in sorted(groups.items())}}
for candidate in ['cached','minimal']:
    pairs=[]
    for i in range(1,6):
        names=[f'{candidate}-{i}-{side}.json' for side in ['baseline',candidate]]
        if not all((d/name).exists() for name in names):continue
        a,b=map(read,names)
        def runner_seconds(record):
            match=re.search(r'duration_ms\s+([\d.]+)',logfile(record['label']).read_text())
            return float(match[1])/1000 if match else record['wallS']
        at,bt=runner_seconds(a),runner_seconds(b)
        pairs.append({'pair':i,'metric':'Node reported duration (wall observation has up to 0.5 s polling lag)','baselineS':at,'candidateS':bt,'baselineObservedWallS':a['wallS'],'candidateObservedWallS':b['wallS'],'deltaPercent':100*(bt/at-1),'baselineCpuS':a['userCpuS']+a['systemCpuS'],'candidateCpuS':b['userCpuS']+b['systemCpuS'],'baselineRssKiB':a['maxChildRssKiB'],'candidateRssKiB':b['maxChildRssKiB'],'exitCodes':[a['exitCode'],b['exitCode']]})
    summary[candidate]={'pairs':pairs,'baselineS':stat(p['baselineS'] for p in pairs),'candidateS':stat(p['candidateS'] for p in pairs),'deltaPercent':stat(p['deltaPercent'] for p in pairs)}
summary['concurrency']={str(c):[read(f'concurrency-{i}-{c}.json') for i in [1,2] if (d/f'concurrency-{i}-{c}.json').exists()] for c in [1,2]}
for group in summary['concurrency'].values():
    for row in group:row.pop('memorySamples',None)
if (d/'boot-profile.json').exists(): summary['bootProfile']=read('boot-profile.json')
if (d/'boot-prototypes.json').exists():
    rows=read('boot-prototypes.json');summary['bootModels']={}
    for candidate in ['cap1024','walk-cache']:
      for scenario in ['new','advanced']:
        groups={name:[r for r in rows if r['candidate']==candidate and r['scenario']==scenario and r['name']==name] for name in ['baseline',candidate]}
        summary['bootModels'][candidate+'-'+scenario]={name:{key:stat(r[key] for r in values) for key in ['cpuMs','frames','capStops','maxSliceMs','frameSlots60HzMs','rssBytes','heapUsedBytes','rssMaxSampled','heapMaxSampled']} for name,values in groups.items()}
if (d/'build-samples.json').exists():
    rows=read('build-samples.json');summary['build']={name:stat(r['ms'] for r in rows if r['name']==name) for name in ['assemble','build']}
cpu=[]
for file in [*d.glob('*.cpuprofile'),*d.glob('*.cpuprofile.gz')]:
    profile=json.loads(gzip.decompress(file.read_bytes()).decode() if file.suffix=='.gz' else file.read_text());nodes={n['id']:n['callFrame'] for n in profile['nodes']};totals=collections.defaultdict(float)
    for sample,delta in zip(profile.get('samples',[]),profile.get('timeDeltas',[])):
        f=nodes[sample];totals[(f.get('functionName') or '(anonymous)',f.get('url','').split('/')[-1][:160],f.get('lineNumber'))]+=delta/1000
    cpu.append({'file':file.name,'durationMs':(profile['endTime']-profile['startTime'])/1000,'topSelfSamplesMs':[{'function':k[0],'source':k[1],'lineZeroBased':k[2],'sampledMs':v} for k,v in sorted(totals.items(),key=lambda kv:-kv[1])[:30]]})
summary['cpuProfiles']=cpu
(d/'summary.json').write_text(json.dumps(summary,indent=2,ensure_ascii=False)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k in ['suite','cached','minimal','bootModels','build','runtimes']},indent=2,ensure_ascii=False))
