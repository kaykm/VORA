from pathlib import Path
import hashlib,json,re,statistics,shutil,subprocess,sys,datetime

root=Path(__file__).parent
dest=Path('/home/jp/Projects/Vora')
data=root/'dados'
target=dest/'docs/melhorias-iniciais'
def read(name):return json.loads((data/name).read_text())
def digest(file):return hashlib.sha256(file.read_bytes()).hexdigest()
for name in ['testes-complete.json','cache-complete.json','cache-limitado/cache-complete.json','cache-numerico/cache-complete.json']:assert read(name)['complete']
for file in data.rglob('*.json'):
 record=json.loads(file.read_text())
 if isinstance(record,dict) and 'exitCode' in record:assert record['exitCode']==0,file
subprocess.run([sys.executable,str(root/'resumir.py'),str(data)],check=True,capture_output=True)
summary=read('resumo.json');assert summary['tests']['performanceAccepted']

allowed={'tests/piso-loja.test.mjs','tests/sombras.test.mjs','tests/carregamento.test.mjs'}
before=read('workspace-before.json')
changed=[name for name,h in before.items() if not (dest/name).is_file() or digest(dest/name)!=h]
assert set(changed)==allowed,changed
assertions={}
for file in sorted(allowed):
 original=(root/'experimentos/baseline'/file).read_text();current=(dest/file).read_text()
 def counts(text):
  return {name:len(re.findall(r'assert\.'+name+r'\(',text)) for name in set(re.findall(r'assert\.(\w+)\(',text))}
 assert counts(original)==counts(current),file
 assert len(re.findall(r'\btest\(',original))==len(re.findall(r'\btest\(',current)),file
 assertions[file]=counts(current)
generation={}
for name,repo in [('workspace',dest),('cache',root/'experimentos/cache-numerico')]:
 captures=[]
 for iteration in range(2):
  subprocess.run(['node','scripts/gerar.mjs'],cwd=repo,check=True,capture_output=True)
  captures.append({file:digest(repo/file) for file in ['dist/VORA.html','dist/index.html','dist/manifesto.json']})
 assert captures[0]==captures[1]
 generation[name]=captures
(data/'integrity-final.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
 'checkedExistingFiles':len(before),'changedExistingFiles':changed,'assertionCountsUnchanged':assertions,
 'originalAuditUnchanged':True,'productionSourcesUnchanged':True,'backupSha256':digest(dest/'backup/VORA-original-17.html'),
 'generation':generation},indent=2)+'\n')
subprocess.run([sys.executable,str(root/'gerar-patches.py'),str(target/'entregas')],check=True,capture_output=True)
hashes=read('html-hashes.json')
matrix={'status':'not_measured','reason':'Only IAB and MCP Apps surfaces; no disposable context/pre-navigation profiling API; previous file:// policy denial respected. No authorized preview of candidate was supplied or published.',
 'plannedNavigationsPerVersion':40,'plannedNavigationsTotal':80,'versions':[],'browserMemory':None,'postLoadP95FrameMs':None,'cacheIncorporationAllowed':False}
for version,sha in [('reference',hashes['testes']),('candidate',hashes['cache'])]:
 matrix['versions'].append({'version':version,'sha256':sha,'url':None if version=='candidate' else 'https://kaykm.github.io/VORA/',
  'cases':[{'mode':mode,'save':save,'opening':opening,'plannedSamples':5,'samples':[]} for mode in ['pages','file'] for save in ['new','advanced'] for opening in ['first','reload']]})
(data/'browser-matrix.json').write_text(json.dumps(matrix,indent=2)+'\n')
(target/'dados').mkdir(parents=True,exist_ok=True);(target/'coleta').mkdir(exist_ok=True)
for file in data.rglob('*'):
 if file.is_file():
  relative=file.relative_to(data)
  if file.suffix=='.log':relative=relative.with_suffix('.txt')
  output=target/'dados'/relative;output.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(file,output)
for file in root.iterdir():
 if file.suffix in ['.py','.mjs']:shutil.copyfile(file,target/'coleta'/file.name)
for name in ['testes-transcript.txt','cache-transcript.txt','cache-limitado-transcript.txt','cache-numerico-transcript.txt']:shutil.copyfile(root/name,target/'dados'/name)

fmt=lambda value,n=2:f'{value:.{n}f}'.replace('.',',')
table=lambda rows:'\n'.join('| '+' | '.join(map(str,row))+' |' for row in rows)
tests=summary['tests'];groups=summary['cache']
test_rows=table([[p['pair'],fmt(p['baselineMs']/1000,3),fmt(p['candidateMs']/1000,3),fmt(p['deltaPercent'],1)+'%'] for p in tests['pairs']])
boot_rows=[]
memory_rows=[]
for key,name in [('new','Nova'),('advanced','Avançada')]:
 group=groups[key]
 boot_rows.append([name,fmt(group['baselineActiveMs']['median']/1000,3),fmt(group['candidateActiveMs']['median']/1000,3),fmt(group['medianActiveReductionPercent'],1)+'%',
  fmt(group['baselineActiveMs']['min']/1000,3)+'–'+fmt(group['baselineActiveMs']['max']/1000,3),fmt(group['candidateActiveMs']['min']/1000,3)+'–'+fmt(group['candidateActiveMs']['max']/1000,3)])
 memory_rows.append([name,fmt(group['baselineMaxRssBootKiB']['median']/1024,1),fmt(group['candidateMaxRssBootKiB']['median']/1024,1),fmt(group['medianRssChangePercent'],1)+'%',
  'Passou' if group['nodeMemoryAccepted'] else 'Reprovou'])
suites=table([[name,record['files'],fmt(record['nodeTestDurationMs']/1000,1),record['exitCode']] for name,record in summary['officialSuites'].items()])
checks=table([[name,'Passou' if groups[key]['nodeTimeAccepted'] else 'Reprovou','Passou' if groups[key]['nodeMemoryAccepted'] else 'Reprovou'] for key,name in [('new','Nova'),('advanced','Avançada')]])
report=f'''# Melhorias iniciais nos testes e no carregamento

Implementação de 1º de novembro de 2026, baseada na [auditoria original](AUDITORIA-TESTES-E-CARREGAMENTO.md), que permanece intacta. Referência fixa: `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`.

## Resultado e estado das entregas

**As melhorias dos testes estão aplicadas à cópia local e aprovadas.** Nos três arquivos afetados, a mediana passou de **{fmt(tests['baselineMs']['median']/1000,2)} para {fmt(tests['candidateMs']['median']/1000,2)} segundos**, com melhora nos cinco pares. A mediana das diferenças pareadas foi de **{fmt(-tests['pairedDeltaPercent']['median'],1)}% de redução**. Isso é resultado do subconjunto afetado; não é uma redução percentual demonstrada da suíte inteira.

**O cache dos caminhos está implementado em cópia isolada e entregue como patch pendente. Não foi aplicado a `src/` nem ao HTML principal.** As verificações de Node e geometria estão documentadas abaixo. A adoção continua bloqueada pela validação real obrigatória: não houve contexto descartável/instrumentação de navegador disponível, o bloqueio anterior de `file://` foi respeitado e nenhuma prévia Pages do candidato foi fornecida ou publicada.

Não houve commit, push, publicação, merge ou alteração de preferências/saves pessoais. A pasta principal continua sem metadados Git utilizáveis; os patches permitem revisar e reproduzir as duas alterações separadamente.

## Referência e condições

Os 184 arquivos protegidos em comum com a referência auditada tinham os mesmos hashes antes das edições. Como o commit não mudou, a condição de repetir três suítes antes de alterar não foi acionada. As três rodadas anteriores continuam como referência histórica; as comparações desta implementação são novos pares contemporâneos, sem substituir amostras por números históricos.

A máquina é a mesma bancada AMD Ryzen 5 5500, com RAM física de aproximadamente 16,62 GB. Versões e estado observado de memória/carga estão em [environment.json](melhorias-iniciais/dados/environment.json). A máquina não foi inteiramente isolada de outros aplicativos. Referências e candidatos rodaram sequencialmente, sem disputar CPU entre si; a suíte manteve seus dois processos internos.

Todas as medições do jogo abaixo são **Node/DOM simulado/SoftwareGL ou buffers nativos em memória**. Os tempos da suíte vêm do relatório do Node; CPU e RSS externos ficam nos registros. RSS soma páginas residentes, incluindo compartilhadas, e não representa memória física exclusiva.

## Entrega 1 — preparação dos testes

| Alteração | Trabalho omitido | Proteção preservada |
| --- | --- | --- |
| Piso usa `boot:'manual'` | Geração incidental de mundo, modelos, caminhos, vegetação e configuração completa | Todas as verificações do recorte, borda, chanfro e shader; inicialização completa permanece em jogo/carregamento |
| Somente o cenário de orçamento de sombras usa `boot:'manual'` | O mesmo boot incidental, dispensável para consultar limites com GL simulado | Limites móvel/desktop/textura/depth e todos os perfis; os demais cenários continuam com boot completo, inclusive preferências, reset, fila e falha |
| Progresso e prontidão são lidos juntos por retomada | Uma chamada à VM em cada ponto observado | Todas as verificações intermediárias de monotonicidade, bloqueio, falha e ausência de save parcial |

Não se compartilharam estado, mundo, DOM, armazenamento ou contextos mutáveis. Não se retiraram cenários nem asserções; a conferência por arquivo está em [integridade](melhorias-iniciais/dados/integrity-final.json). O executor oficial e os demais arquivos de teste não foram alterados.

Cinco pares alternados, mesmos três arquivos, concorrência dois, duração informada pelo Node:

| Par | Original, s | Testes alterados, s | Diferença |
| --- | ---: | ---: | ---: |
{test_rows}

O critério era redução mediana e melhora em pelo menos quatro dos cinco pares. **Passou em cinco de cinco.** Também passaram as execuções individuais dos três arquivos e a execução conjunta em ordem inversa, com concorrência um para observar essa ordem. Isso não constitui uma campanha de todas as permutações internas de casos.

## Entrega 2 — cache dos caminhos, pendente de adoção

O candidato memoriza avaliações de coordenadas exatas no recorte e nas normais, dentro de uma única construção. Usa buffers numéricos fixos para 4.096 posições, com 102.416 bytes em buffers, além dos objetos de controle do motor JavaScript. O hash dos bits apenas seleciona uma posição: ambas as coordenadas originais precisam coincidir exatamente para reutilizar o valor. Colisões substituem entradas e podem provocar recálculo; não arredondam coordenadas nem alteram o campo.

As entradas são invalidadas a cada linha da malha; coordenadas, valores e marcadores são zerados em `finally`, em conclusão, cancelamento ou erro. Não há estado persistente entre construções.

A primeira variante, limitada somente por linha, foi **reprovada por memória**: os cinco pares isolados mostraram aumento mediano de RSS superior a 40% nos dois saves. Uma segunda variante, também limitada a 4.096 entradas, ainda aumentou a mediana em 36,8% na partida nova e 32,4% na avançada. Ambas usavam chaves de texto e foram rejeitadas, apesar da aceleração. Os dados, [síntese da primeira](melhorias-iniciais/dados/resumo-cache-sem-limite.json), [síntese da segunda](melhorias-iniciais/dados/resumo-cache-limitado.json) e patches rejeitados foram preservados. O armazenamento numérico fixo da terceira variante evita essas chaves temporárias. Cada variante teve cinco pares completos, sem misturar amostras; os limites de aceitação permaneceram iguais.

Essa coleta resolve uma limitação da auditoria: seu RSS vinha de um processo que executava várias variantes e não comprovava pico isolado. A conclusão nova utiliza processos separados e a mesma métrica em ambos os lados.

Foram mantidos a malha 291×291, as 18 iterações de busca, limiares, ordem de vértices, materiais, generators e pontos de devolução de controle. O limite de 64 retomadas e o orçamento de 5 ms continuam iguais. Nenhum trabalho foi transferido para o render ou para depois da prontidão.

### Correção e cancelamento

O teste de carregamento do candidato verifica hashes dos bytes e estatísticas dos caminhos usando o ambiente que já terminou o boot. Os oráculos vêm dos dados anteriores à otimização, no commit fixado; não foram regenerados a partir do candidato para fazê-lo passar.

Um teste adicional usa preparação manual e buffers em memória. Ele mantém duas construções preenchidas simultaneamente, confirma isolamento, cancela cada uma, injeta falha no campo e reconstrói a malha inteira. Confere limpeza de temporários, limite de entradas nas linhas densas, bytes, índices, ranges, estatísticas e contagem dos yields. Esse teste acrescenta uma construção dirigida de geometria, sem outro boot completo de mundo/interface/vegetação.

A malha nativa conserva **132.165 vértices e 4.757.940 bytes**, com o mesmo fallback sem índices. As malhas menores indexadas continuam verificadas pelos testes existentes. Essas verificações não executam shaders nem GPU.

### Tempo e memória em processos isolados

Cinco pares por save, ordem alternada, vinte processos de amostragem independentes. Cada processo carrega apenas uma variante. O driver real usa relógio de parede, mas os callbacks RAF são drenados imediatamente pelo harness. O tempo ativo inclui escalonamento e GC dentro dos callbacks; não é duração de navegação, espera entre quadros ou contador de CPU do sistema.

| Partida | Original mediano, s | Candidato mediano, s | Redução das medianas | Faixa original, s | Faixa candidato, s |
| --- | ---: | ---: | ---: | ---: | ---: |
{table(boot_rows)}

Todos os pares conservaram snapshots de estado, save, mundo, câmera, bytes dos caminhos, estatísticas, malhas da loja, contadores de recursos, prontidão e número de retomadas.

A métrica de memória abaixo é o máximo de RSS do processo até a prontidão, obtido antes da serialização dos snapshots. Cada amostra usa um processo novo. O máximo de heap/RSS amostrado após callbacks também está nos dados; não deve ser confundido com a marca de máximo do sistema. Não houve GC forçado.

| Partida | RSS original mediano, MiB | RSS candidato mediano, MiB | Variação | Critério Node ≤10% |
| --- | ---: | ---: | ---: | --- |
{table(memory_rows)}

Os detalhes, extremos e cada diferença pareada constam em [resumo.json](melhorias-iniciais/dados/resumo.json). Nenhum outlier foi excluído.

### Após a prontidão

Os replays de partida nova e avançada executaram 1.200 passos determinísticos com movimento, giro e zoom, e compararam os pixels de cinco imagens CPU em pontos padronizados, além do snapshot final. Os resultados das variantes coincidiram. Os dados registram tempos de simulação, renders e picos da fila, mas há somente um replay por variante/save; não se usa essa checagem para aprovar desempenho depois do boot.

Os vinte segundos são **virtuais de simulação**. Não houve vinte segundos reais de navegador nem medição válida de p95 dos quadros. Nenhuma ausência de regressão visual/GPU é inferida dessas imagens CPU.

## Suítes e critérios de incorporação

| Verificação oficial | Arquivos aprovados | Duração Node, s | Saída |
| --- | ---: | ---: | ---: |
{suites}

A suíte principal permanece com 24 arquivos. A cópia do candidato tem 25, incluindo o novo contrato de cache. Essas execuções completas aprovam os estados finais; não são cinco pares da suíte inteira e não isolam o efeito de cada otimização na duração total.

| Save | Tempo ativo Node: redução ≥10% | Memória Node: aumento ≤10% |
| --- | --- | --- |
{checks}

Os demais critérios **continuam pendentes**: primeiro quadro mais cedo em quatro de cinco pares de cada combinação real, ausência de regressão funcional/visual no navegador, aumento mediano de memória real de no máximo 10% e piora mediana de p95 de no máximo 5% nos vinte segundos seguintes. **Os limites não foram afrouxados. Aprovação em Node não autoriza incorporar o cache.**

A [matriz do navegador](melhorias-iniciais/dados/browser-matrix.json) registra quarenta navegações planejadas por versão, oitenta no total, com campos de amostras vazios. Para validar Pages será necessária uma prévia autorizada com o SHA do candidato; a página atual não é essa prévia. Não se substituiu `file://` por HTTP, não se usaram perfis pessoais e não se contornaram bloqueios.

## Alternativas descartadas ou adiadas

| Alternativa | Decisão e motivo |
| --- | --- |
| Cache de `vm.Script` | Não incorporado: ganho anterior inconclusivo; não foi repetido como se fosse uma nova otimização aprovada |
| Cache dos caminhos limitado somente por linha | Reprovado: aumento mediano de memória superior a 40% nos dois saves; substituído para avaliação pelo cache também limitado a 4.096 entradas |
| Cache com chaves de texto e limite de 4.096 entradas | Reprovado: aumento mediano de RSS de 36,8%/32,4%; o limite de entradas sozinho não resolveu o pico do processo |
| Compartilhar mundo/contexto mutável ou retirar asserções | Descartado por enfraquecer isolamento e cobertura |
| Aumentar concorrência acima de dois | Adiado; permanece a configuração medida e o limite de memória conhecido |
| Mudar teto de retomadas, pesos/progresso ou dividir operações atômicas | Adiado conforme o escopo escolhido; não houve alteração desses contratos |
| Reduzir qualidade, preparar somente o visível ou postergar vegetação | Adiado; pode mudar aparência ou transferir travamentos para a partida |
| WebAssembly, dependências novas ou troca de renderizador | Fora desta primeira entrega |
| Incorporar o cache com aprovação apenas de Node | Rejeitado pelo critério de validação real adotado no plano |

Uma preparação inicial do candidato foi rejeitada pelo gerador porque o preparador reaplicou a transformação sobre sua própria saída. O preparador foi corrigido para ler a cópia fixa dos testes e a geração foi refeita; nenhuma amostra usou o HTML rejeitado. O evento está registrado nos [eventos de coleta](melhorias-iniciais/dados/collection-events.json).

## Artefatos, integridade e reprodução

- [01-testes.patch](melhorias-iniciais/entregas/01-testes.patch): as três mudanças de testes aplicadas à cópia local.
- [02-cache-caminhos-PENDENTE.patch](melhorias-iniciais/entregas/02-cache-caminhos-PENDENTE.patch): fonte do cache, seus testes/oráculos e documentação, somente para revisão em cópia isolada.
- [Instruções e mapa dos dados](melhorias-iniciais/LEIA-ME.md): reprodução sem aplicar o candidato ao projeto principal.

Os patches podem ser examinados separadamente e passaram na verificação de aplicação contra a referência fixa. A cópia principal manteve fontes de produção, backup e bytes da distribuição. A geração foi repetida duas vezes na cópia principal e no candidato, com resultados determinísticos. Os hashes dos HTMLs identificam qual versão cada medição representa.

A auditoria original e seus dados permanecem intactos. A documentação e os novos registros desta implementação são adicionais. O cache permanece fora da distribuição principal enquanto seus critérios reais não forem cumpridos.
'''
if (data/'relocacao.json').exists():
 report+='\n\n## Diretório de trabalho e nova tentativa offline\n\nAs cópias desta etapa foram movidas para dentro do projeto, com conferência de todos os arquivos antes de atualizar os scripts:\n\n- `.tmp/melhorias-iniciais/`: candidatos, medições e instrumentos desta implementação.\n- `.tmp/auditoria/`: área de trabalho da auditoria anterior.\n- `.tmp/auditoria-base/`: referência Git fixa, ainda no mesmo commit.\n\nO candidato final está em `.tmp/melhorias-iniciais/experimentos/cache-numerico/`. O executor de reprodução agora cria suas cópias em `.tmp/repro-melhorias-*` do próprio projeto. Os caminhos antigos nos dados brutos foram preservados como histórico; o [registro de realocação](melhorias-iniciais/dados/relocacao.json) relaciona as duas localizações.\n\nA nova abertura direta do HTML candidato por `file://` foi recusada antes da navegação pela política do navegador da ferramenta, que permite somente HTTP/HTTPS e proíbe contornar essa recusa por outro navegador ou comandos. O usuário informou que ainda não possui resultado de execução local. O [registro da tentativa](melhorias-iniciais/dados/file-validation-attempt.json) conserva a pendência, sem apresentar tempo de carregamento ou jogabilidade como medidos.\n\nForam executadas as verificações de estrutura e publicação na pasta principal e no candidato já realocado. Ambas passaram: geração determinística, recursos embutidos, ausência de downloads, backup íntegro e entrada relativa correta. Os hashes dos HTMLs continuam iguais aos das versões medidas anteriormente. O preparador de reprodução também foi exercitado até gerar as três cópias: todas ficaram dentro do projeto, com os hashes esperados, sem repetir a bancada completa. O registro está em [preparação dos diretórios](melhorias-iniciais/dados/preparacao-diretorio.json). Isso comprova a integridade do pacote e dos caminhos; a execução real no navegador por `file://` segue sem validação. Veja os [resultados do pacote](melhorias-iniciais/dados/pacote-offline.json).\n'
(dest/'docs/MELHORIAS-INICIAIS-TESTES-E-CARREGAMENTO.md').write_text(report)
print('Delivery report generated. Tests applied; cache remains unincorporated.')
