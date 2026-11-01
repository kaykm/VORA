import pathlib, subprocess, sys, json

root=pathlib.Path(__file__).parent
measure=root/'run-measure.py'
out=root/'dados'
files=['tests/piso-loja.test.mjs','tests/sombras.test.mjs','tests/carregamento.test.mjs']
def run(label, repo, args):
    print('START',label,flush=True)
    subprocess.run([sys.executable,str(measure),str(repo),str(out),label,*args],check=True)
for pair in range(5):
    for variant in (['baseline','testes'] if pair%2==0 else ['testes','baseline']):
        run(f'testes-par-{pair+1}-{variant}',root/'experimentos'/variant,
            ['node','--test','--test-concurrency=2',*files])
for file in files:
    run('isolado-'+pathlib.Path(file).stem,root/'experimentos/testes',['node',file])
run('ordem-inversa',root/'experimentos/testes',['node','--test','--test-concurrency=1',*reversed(files)])
workspace=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else pathlib.Path('/home/jp/Projects/Vora')
run('suite-testes',workspace,['node','scripts/verificar.mjs'])
(out/'testes-complete.json').write_text(json.dumps({'complete':True,'exitCode':0})+'\n')
