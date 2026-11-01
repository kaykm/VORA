import pathlib,subprocess,sys,tarfile,io,difflib,json
repo=pathlib.Path(sys.argv[1]);root=pathlib.Path(sys.argv[2]);out=pathlib.Path(sys.argv[3]);here=pathlib.Path(__file__).parent
archive=subprocess.check_output(['git','archive','HEAD'],cwd=repo)
variants={
 'cap1024':('src/jogo/carregamento.js','count < 64','count < 1024'),
 'walk-cache':('src/mundo/caminhos.js',None,None)}
for name,(file,old,new) in variants.items():
    dest=root/name;dest.mkdir()
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:tar.extractall(dest,filter='data')
    source=(dest/file).read_text()
    if name=='walk-cache':
        subprocess.run(['node','--input-type=module','-e',"import fs from 'node:fs';import {memoizedWalkways} from './walk-prototype.mjs';const file=process.argv[1];fs.writeFileSync(file,memoizedWalkways(fs.readFileSync(file,'utf8')));",str(dest/file)],cwd=here,check=True)
        result=(dest/file).read_text()
    else:
        assert old in source;result=source.replace(old,new,1);(dest/file).write_text(result)
    (root/(name+'.patch')).write_text(''.join(difflib.unified_diff(source.splitlines(True),result.splitlines(True),fromfile='a/'+file,tofile='b/'+file)))
    subprocess.run(['node','scripts/gerar.mjs'],cwd=dest,check=True)
    subprocess.run([sys.executable,str(here/'run-measure.py'),str(dest),str(out),'validate-'+name,'node','--test','--test-concurrency=2','tests/carregamento.test.mjs','tests/fluxo.test.mjs','tests/mesh-incremental.test.mjs','tests/equivalencia.test.mjs','tests/piso-loja.test.mjs'],check=True)
