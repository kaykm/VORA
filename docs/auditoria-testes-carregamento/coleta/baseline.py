import subprocess, sys
from pathlib import Path
here = Path(__file__).parent
repo, out = sys.argv[1:]
for run in range(1,4):
    subprocess.run([sys.executable,str(here/'run-measure.py'),repo,out,f'suite-{run}','node','scripts/verificar.mjs'],check=True)
