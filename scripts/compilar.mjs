import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
export const ROOT=path.resolve(import.meta.dirname,'..');
export const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/fontes.json'),'utf8'));
export function localPath(file){
 const resolved=path.resolve(ROOT,file);
 if(!resolved.startsWith(ROOT+path.sep))throw new Error('Caminho fora do projeto: '+file);
 return resolved;
}
export const read=file=>fs.readFileSync(localPath(file),'utf8');
const literal=value=>JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029');
const mime={'.woff':'font/woff','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
export function expand(source,stack=[]){
 return source.replace(/<!-- @include ([^>]+) -->|\/\* @(text|template|json) ([^*]+) \*\/|@asset ([^"')\s]+)/g,(match,html,kind,script,asset)=>{
  const file=(html||script||asset).trim();
  if(stack.includes(file))throw new Error('Inclusão circular: '+[...stack,file].join(' -> '));
  if(asset){const type=mime[path.extname(file)];if(!type)throw new Error('Tipo de recurso desconhecido: '+file);return 'data:'+type+';base64,'+fs.readFileSync(localPath(file)).toString('base64')}
  const content=read(file);
  if(kind==='text')return literal(content);
  if(kind==='template')return '`'+content+'`'; // Mantém as interpolações GLSL existentes.
  if(kind==='json'){
   const value=JSON.parse(content,(_,v)=>typeof v==='string'&&v.startsWith('@base64 ')?fs.readFileSync(localPath(v.slice(8))).toString('base64'):v);
   return literal(value);
  }
  return expand(content,[...stack,file]);
 });
}
export function assemble(){
 if(new Set(manifest.scripts).size!==manifest.scripts.length)throw new Error('JavaScript duplicado no manifesto');
 const modules=manifest.scripts.map(file=>({file,source:expand(read(file))}));
 for(const mod of modules)new vm.Script(mod.source,{filename:mod.file});
 const javascript=modules.map(m=>m.source).join('');
 new vm.Script(javascript,{filename:'VORA.js'});
 if(/<\/script/i.test(javascript))throw new Error('Fechamento de script dentro do JavaScript');
 let html=expand(read(manifest.template));
 manifest.styles.forEach(({file,attributes},i)=>{
  const css=expand(read(file));if(/<\/style/i.test(css))throw new Error('Fechamento de style dentro do CSS');
  html=html.replace('{{STYLE_'+i+'}}',()=>'<style'+attributes+'>'+css+'</style>');
 });
 html=html.replace('{{SCRIPTS}}',()=>'<script>'+javascript+'</script>');
 if(/\{\{(?:STYLE_\d+|SCRIPTS)\}\}|<!-- @include|\/\* @(?:text|template|json) |@asset |@base64 /.test(html))throw new Error('Marcador de geração não resolvido');
 if(/<(?:script|link|img|iframe|audio|video|source)\b[^>]*\b(?:src|href)\s*=\s*["'](?!data:|#)/i.test(html))throw new Error('Recurso externo no HTML final');
 for(const m of html.matchAll(/url\(\s*["']?([^)'"\s]+)/g))if(!m[1].startsWith('data:')&&!m[1].startsWith('#'))throw new Error('URL externa no CSS: '+m[1]);
 return {html,javascript,modules};
}
export function build(){
 const {html,modules}=assemble();
 const directory=localPath('dist');fs.mkdirSync(directory,{recursive:true});
 // Só substitui a distribuição depois de toda a validação e gravação terminarem.
 for(const name of ['VORA.html','index.html']){
  const dest=path.join(directory,name);
  fs.writeFileSync(dest+'.tmp',html);fs.renameSync(dest+'.tmp',dest);
 }
 const info={sha256:crypto.createHash('sha256').update(html).digest('hex'),bytes:Buffer.byteLength(html),javascriptFiles:modules.length};
 fs.writeFileSync(localPath('dist/manifesto.json'),JSON.stringify(info,null,2)+'\n');
 return info;
}
