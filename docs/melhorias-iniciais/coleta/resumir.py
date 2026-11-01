import pathlib,json,statistics,sys

d=pathlib.Path(sys.argv[1])
def read(name):return json.loads((d/name).read_text())
def stats(values):
 values=list(values)
 return {'n':len(values),'median':statistics.median(values),'min':min(values),'max':max(values)}
testpairs=[]
for pair in range(1,6):
 a=read(f'testes-par-{pair}-baseline.json');b=read(f'testes-par-{pair}-testes.json')
 assert a['exitCode']==b['exitCode']==0
 testpairs.append({'pair':pair,'baselineMs':a['nodeTestDurationMs'],'candidateMs':b['nodeTestDurationMs'],
  'deltaPercent':100*(b['nodeTestDurationMs']/a['nodeTestDurationMs']-1)})
summary={'tests':{'pairs':testpairs,'baselineMs':stats(p['baselineMs'] for p in testpairs),
 'candidateMs':stats(p['candidateMs'] for p in testpairs),'pairedDeltaPercent':stats(p['deltaPercent'] for p in testpairs),
 'improvedPairs':sum(p['candidateMs']<p['baselineMs'] for p in testpairs)}}
summary['tests']['performanceAccepted']=summary['tests']['improvedPairs']>=4 and summary['tests']['candidateMs']['median']<summary['tests']['baselineMs']['median']
cacheData=d
for candidate in ['cache-limitado','cache-numerico']:
 if (d/candidate/'cache-complete.json').exists():cacheData=d/candidate
def readCache(name):return json.loads((cacheData/name).read_text())
if (cacheData/'cache-complete.json').exists():
 summary['candidateDataset']=str(cacheData.relative_to(d))
 summary['cache']={}
 for scenario in ['new','advanced']:
  pairs=[]
  for pair in range(1,6):
   a=readCache(f'cache-par-{pair}-{scenario}-testes-amostra.json');b=readCache(f'cache-par-{pair}-{scenario}-cache-amostra.json')
   assert a['snapshot']==b['snapshot'] and a['steps']==b['steps']
   pairs.append({'pair':pair,'baselineActiveMs':a['activeMs'],'candidateActiveMs':b['activeMs'],
    'activeDeltaPercent':100*(b['activeMs']/a['activeMs']-1),
    'baselineMaxRssBootKiB':a['maxRssBootKiB'],'candidateMaxRssBootKiB':b['maxRssBootKiB'],
    'baselineCallbacks':a['callbacks'],'candidateCallbacks':b['callbacks']})
  group={'pairs':pairs}
  for key in ['baselineActiveMs','candidateActiveMs','activeDeltaPercent','baselineMaxRssBootKiB','candidateMaxRssBootKiB','baselineCallbacks','candidateCallbacks']:
   group[key]=stats(p[key] for p in pairs)
  group['medianActiveReductionPercent']=100*(1-group['candidateActiveMs']['median']/group['baselineActiveMs']['median'])
  group['medianRssChangePercent']=100*(group['candidateMaxRssBootKiB']['median']/group['baselineMaxRssBootKiB']['median']-1)
  group['nodeTimeAccepted']=group['medianActiveReductionPercent']>=10
  group['nodeMemoryAccepted']=group['medianRssChangePercent']<=10
  summary['cache'][scenario]=group
 summary['cacheIncorporation']={'allowed':False,'reason':'Real desktop browser matrix, candidate Pages preview, file://, browser memory and post-load p95 remain unmeasured. Thresholds unchanged.'}
summary['officialSuites']={}
for name in ['suite-testes','suite-cache']:
 source=d if name=='suite-testes' else cacheData
 if (source/(name+'.json')).exists():
  record=json.loads((source/(name+'.json')).read_text())
  summary['officialSuites'][name]={key:record[key] for key in ['exitCode','wallS','userCpuS','systemCpuS','nodeTestDurationMs','peakSampledTreeRssKiB']}
  summary['officialSuites'][name]['files']=len(record['files'])
(d/'resumo.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
