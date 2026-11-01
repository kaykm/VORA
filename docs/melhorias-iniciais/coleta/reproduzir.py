"""Reproduce in a fresh temporary directory; never apply patches to the input repo."""
from pathlib import Path
import subprocess,sys,tempfile,tarfile,io,shutil,json

here=Path(__file__).resolve().parent
project=next(parent for parent in here.parents if (parent/'scripts/fontes.json').is_file())
reference=Path(sys.argv[1]).resolve() if len(sys.argv)>1 else project/'.tmp/auditoria-base'
commit='f9fcbccdeaf4fc22f07862eb44f1c7c486926d22'
archive=subprocess.check_output(['git','archive',commit],cwd=reference)
workdir=project/'.tmp'
workdir.mkdir(exist_ok=True)
root=Path(tempfile.mkdtemp(prefix='repro-melhorias-',dir=workdir))
for script in here.iterdir():
 if script.suffix in ['.py','.mjs']:shutil.copyfile(script,root/script.name)
(root/'dados').mkdir();(root/'experimentos').mkdir()
shutil.copyfile(project/'docs/melhorias-iniciais/dados/synthetic-advanced.json',root/'dados/synthetic-advanced.json')
for variant in ['baseline','testes','cache']:
 dest=root/'experimentos'/variant;dest.mkdir()
 with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(dest,filter='data')
 if variant!='baseline':subprocess.run(['git','apply',str(project/'docs/melhorias-iniciais/entregas/01-testes.patch')],cwd=dest,check=True)
 if variant=='cache':subprocess.run(['git','apply',str(project/'docs/melhorias-iniciais/entregas/02-cache-caminhos-PENDENTE.patch')],cwd=dest,check=True)
 subprocess.run(['node','scripts/gerar.mjs'],cwd=dest,check=True)
print('Temporary measurements:',root,flush=True)
subprocess.run([sys.executable,str(root/'testar-entrega.py'),str(root/'experimentos/testes')],check=True)
subprocess.run([sys.executable,str(root/'validar-cache.py')],check=True)
subprocess.run([sys.executable,str(root/'resumir.py'),str(root/'dados')],check=True)
print('Candidate remains unincorporated. Real browser validation is a separate required gate.')
