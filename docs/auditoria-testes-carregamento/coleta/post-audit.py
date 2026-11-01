import pathlib,subprocess,sys,os,json,time
here=pathlib.Path(__file__).parent
repo=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);experiments=here/'experimentos'
measure=here/'run-measure.py'
def run(label,cmd,cwd=repo,env=None):
    print('START',label,flush=True)
    subprocess.run([sys.executable,str(measure),str(cwd),str(out),label,*cmd],check=True,env=env)
env=os.environ.copy();env['VORA_AUDIT_RUNTIME_LOG']=str(out/'runtimes.ndjson')
run('profile-suite',['node','scripts/verificar.mjs'],experiments/'profile',env)
run('profile-boot',['node','--cpu-prof','--cpu-prof-dir='+str(out),str(here/'boot-audit.mjs'),str(repo),str(out),'profile'])
for candidate,file in [('cached','tests/jogo.test.mjs'),('minimal','tests/piso-loja.test.mjs')]:
    for pair in range(5):
        for side in ([candidate,'baseline'] if pair%2 else ['baseline',candidate]):
            run(f'{candidate}-{pair+1}-{side}',['node',file],repo if side=='baseline' else experiments/candidate)
heavy=['tests/expansao-economia.test.mjs','tests/sombras.test.mjs','tests/jogo.test.mjs','tests/equivalencia.test.mjs']
for pair in range(2):
    for concurrency in ([2,1] if pair else [1,2]):
        run(f'concurrency-{pair+1}-{concurrency}',['node','--test','--test-concurrency='+str(concurrency),*heavy])
run('models-boot',['node',str(here/'boot-audit.mjs'),str(repo),str(out),'models'])
run('validate-loading',['python3',str(here/'validate-loading.py'),str(repo),str(experiments),str(out)])
run('replay',['node',str(here/'replay.mjs'),str(repo),str(experiments),str(out)])
run('build-cost',['node',str(here/'build-cost.mjs'),str(repo),str(out)])
(out/'post-complete.json').write_text(json.dumps({'complete':True,'allStageExitCodesZero':True})+'\n')
