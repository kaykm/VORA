// Export the real preview's framebuffer from an isolated deterministic game.
// This inspects model rendering, not browser layout or physical input.
import fs from 'node:fs';
import path from 'node:path';
import {assemble,ROOT} from './compilar.mjs';
import {createRuntime} from '../tests/ambiente.mjs';
import {png} from '../tests/png.mjs';

const game=createRuntime(assemble().html,null,{width:1440,height:900});
const shots=[],directory=path.join(ROOT,'tests/resultados');fs.mkdirSync(directory,{recursive:true});
game.run(`
 refreshDossier();showModal('dossierModal',$('detailsBtn'));
 $('dossierCanvas').getBoundingClientRect=()=>({width:400,height:218});
`);
for(const id of game.json('dossierView.catalog.map(entry=>entry.id)')){
 game.run(`selectDossierEntry(${JSON.stringify(id)});`);
 const shot=game.json(`({name:dossierCurrent().entry.name,status:dossierAssessment(dossierCurrent().object).status,
  dimensions:$('dossierDimensions').textContent,radius:$('dossierRadius').textContent})`);
 shots.push(shot);game.run('drawDossierModel()');
 const visible=game.run('dossierView.renderer.zbuffer.filter(z=>z<1).length');
 if(visible<100)throw Error('Prévia vazia: '+shot.name);
 const image=game.run('dossierView.renderer.image');shot.file='dossie-'+id+'.png';
 fs.writeFileSync(path.join(directory,shot.file),png(image.width,image.height,image.data));
}
fs.writeFileSync(path.join(directory,'dossie-previas.json'),JSON.stringify({width:400,height:218,scope:'Framebuffer real da prévia SoftwareGL; DOM simulado, sem navegador ou saves reais.',shots}));
console.log(shots.length+' modelos renderizados e exportados.');
