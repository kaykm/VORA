#!/usr/bin/env python3
"""Measure an authorized command; /proc RSS sum is not unique physical memory."""
import sys, os, json, time, resource, subprocess, re, pathlib, datetime

repo, out, label, *command = sys.argv[1:]
out = pathlib.Path(out); out.mkdir(parents=True, exist_ok=True)
def mem():
    return {line.split(':')[0]: int(line.split()[1]) for line in pathlib.Path('/proc/meminfo').read_text().splitlines() if line.startswith(('MemAvailable:', 'SwapFree:'))}
def tree_rss(root):
    entries = {}
    for entry in pathlib.Path('/proc').iterdir():
        if not entry.name.isdigit(): continue
        try:
            fields = (entry/'stat').read_text().rsplit(')',1)[1].split()
            entries[int(entry.name)] = (int(fields[1]), int(fields[21])*os.sysconf('SC_PAGE_SIZE')//1024)
        except (OSError, ValueError, IndexError): pass
    selected = {root}
    while True:
        expanded = selected | {pid for pid,(parent,_) in entries.items() if parent in selected}
        if expanded == selected: break
        selected = expanded
    return sum(entries.get(pid,(0,0))[1] for pid in selected)
before = resource.getrusage(resource.RUSAGE_CHILDREN)
record = {'label':label,'command':command,'cwd':repo,'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'memoryBeforeKiB':mem(),'loadBefore':os.getloadavg()}
start = time.perf_counter(); peak = 0; samples = []
with (out/(label+'.log')).open('w') as log:
    process = subprocess.Popen(command, cwd=repo, stdout=log, stderr=subprocess.STDOUT)
    while process.poll() is None:
        rss = tree_rss(process.pid); peak = max(peak,rss)
        samples.append({'elapsedS':time.perf_counter()-start,'treeRssKiB':rss,**mem()})
        time.sleep(.5)
after = resource.getrusage(resource.RUSAGE_CHILDREN)
record.update(exitCode=process.returncode,wallS=time.perf_counter()-start,userCpuS=after.ru_utime-before.ru_utime,systemCpuS=after.ru_stime-before.ru_stime,maxChildRssKiB=after.ru_maxrss,peakSampledTreeRssKiB=peak,memoryAfterKiB=mem(),loadAfter=os.getloadavg(),memorySamples=samples)
log = (out/(label+'.log')).read_text()
duration = re.search(r'duration_ms\s+([\d.]+)',log)
record['nodeTestDurationMs'] = float(duration[1]) if duration else None
record['files'] = [{'file':m[1],'ms':float(m[2])} for m in re.finditer(r'✔ (tests/[^\s]+) \(([\d.]+)ms\)',log)]
(out/(label+'.json')).write_text(json.dumps(record,indent=2)+'\n')
print(json.dumps({k:v for k,v in record.items() if k not in ('memorySamples','files')},indent=2),flush=True)
sys.exit(process.returncode)
