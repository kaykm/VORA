# Melhorias iniciais nos testes e no carregamento

Implementação de 1º de novembro de 2026, baseada na [auditoria original](AUDITORIA-TESTES-E-CARREGAMENTO.md), que permanece intacta. Referência fixa: `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`.

## Resultado e estado das entregas

**As melhorias dos testes estão aplicadas à cópia local e aprovadas.** Nos três arquivos afetados, a mediana passou de **42,88 para 33,33 segundos**, com melhora nos cinco pares. A mediana das diferenças pareadas foi de **21,8% de redução**. Isso é resultado do subconjunto afetado; não é uma redução percentual demonstrada da suíte inteira.

**O cache dos caminhos está implementado em cópia isolada e entregue como patch pendente. Não foi aplicado a `src/` nem ao HTML principal.** As verificações de Node e geometria estão documentadas abaixo. A adoção continua bloqueada pela validação real obrigatória: não houve contexto descartável/instrumentação de navegador disponível, o bloqueio anterior de `file://` foi respeitado e nenhuma prévia Pages do candidato foi fornecida ou publicada.

Na entrega local das medições não houve commit, push, publicação ou merge. A branch `perf/testes-carregamento-inicial` foi preparada posteriormente, a pedido do usuário, para revisão compartilhada: contém as três melhorias dos testes, os relatórios e as evidências; o cache continua somente como patch pendente. Não houve alteração de preferências/saves pessoais nem incorporação do cache. Os patches permitem revisar e reproduzir as duas alterações separadamente.

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
| 1 | 41,403 | 33,329 | -19,5% |
| 2 | 43,043 | 33,289 | -22,7% |
| 3 | 42,720 | 33,708 | -21,1% |
| 4 | 43,159 | 33,760 | -21,8% |
| 5 | 42,883 | 32,889 | -23,3% |

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
| Nova | 4,383 | 3,375 | 23,0% | 4,328–4,692 | 3,333–3,522 |
| Avançada | 4,500 | 3,382 | 24,9% | 4,374–4,641 | 3,348–3,525 |

Todos os pares conservaram snapshots de estado, save, mundo, câmera, bytes dos caminhos, estatísticas, malhas da loja, contadores de recursos, prontidão e número de retomadas.

A métrica de memória abaixo é o máximo de RSS do processo até a prontidão, obtido antes da serialização dos snapshots. Cada amostra usa um processo novo. O máximo de heap/RSS amostrado após callbacks também está nos dados; não deve ser confundido com a marca de máximo do sistema. Não houve GC forçado.

| Partida | RSS original mediano, MiB | RSS candidato mediano, MiB | Variação | Critério Node ≤10% |
| --- | ---: | ---: | ---: | --- |
| Nova | 215,4 | 218,4 | 1,4% | Passou |
| Avançada | 213,7 | 215,5 | 0,9% | Passou |

Os detalhes, extremos e cada diferença pareada constam em [resumo.json](melhorias-iniciais/dados/resumo.json). Nenhum outlier foi excluído.

### Após a prontidão

Os replays de partida nova e avançada executaram 1.200 passos determinísticos com movimento, giro e zoom, e compararam os pixels de cinco imagens CPU em pontos padronizados, além do snapshot final. Os resultados das variantes coincidiram. Os dados registram tempos de simulação, renders e picos da fila, mas há somente um replay por variante/save; não se usa essa checagem para aprovar desempenho depois do boot.

Os vinte segundos são **virtuais de simulação**. Não houve vinte segundos reais de navegador nem medição válida de p95 dos quadros. Nenhuma ausência de regressão visual/GPU é inferida dessas imagens CPU.

## Suítes e critérios de incorporação

| Verificação oficial | Arquivos aprovados | Duração Node, s | Saída |
| --- | ---: | ---: | ---: |
| suite-testes | 24 | 198,5 | 0 |
| suite-cache | 25 | 163,0 | 0 |

A suíte principal permanece com 24 arquivos. A cópia do candidato tem 25, incluindo o novo contrato de cache. Essas execuções completas aprovam os estados finais; não são cinco pares da suíte inteira e não isolam o efeito de cada otimização na duração total.

| Save | Tempo ativo Node: redução ≥10% | Memória Node: aumento ≤10% |
| --- | --- | --- |
| Nova | Passou | Passou |
| Avançada | Passou | Passou |

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


## Diretório de trabalho e nova tentativa offline

As cópias desta etapa foram movidas para dentro do projeto, com conferência de todos os arquivos antes de atualizar os scripts:

- `.tmp/melhorias-iniciais/`: candidatos, medições e instrumentos desta implementação.
- `.tmp/auditoria/`: área de trabalho da auditoria anterior.
- `.tmp/auditoria-base/`: referência Git fixa, ainda no mesmo commit.

O candidato final está em `.tmp/melhorias-iniciais/experimentos/cache-numerico/`. O executor de reprodução agora cria suas cópias em `.tmp/repro-melhorias-*` do próprio projeto. Os caminhos antigos nos dados brutos foram preservados como histórico; o [registro de realocação](melhorias-iniciais/dados/relocacao.json) relaciona as duas localizações.

A nova abertura direta do HTML candidato por `file://` foi recusada antes da navegação pela política do navegador da ferramenta, que permite somente HTTP/HTTPS e proíbe contornar essa recusa por outro navegador ou comandos. O usuário informou que ainda não possui resultado de execução local. O [registro da tentativa](melhorias-iniciais/dados/file-validation-attempt.json) conserva a pendência, sem apresentar tempo de carregamento ou jogabilidade como medidos.

Foram executadas as verificações de estrutura e publicação na pasta principal e no candidato já realocado. Ambas passaram: geração determinística, recursos embutidos, ausência de downloads, backup íntegro e entrada relativa correta. Os hashes dos HTMLs continuam iguais aos das versões medidas anteriormente. O preparador de reprodução também foi exercitado até gerar as três cópias: todas ficaram dentro do projeto, com os hashes esperados, sem repetir a bancada completa. O registro está em [preparação dos diretórios](melhorias-iniciais/dados/preparacao-diretorio.json). Isso comprova a integridade do pacote e dos caminhos; a execução real no navegador por `file://` segue sem validação. Veja os [resultados do pacote](melhorias-iniciais/dados/pacote-offline.json).

## Verificação antes do push da branch de revisão

A cópia Git de revisão, em `.tmp/revisao-testes-carregamento`, foi criada a partir da mesma `main` auditada (`f9fcbcc`). A verificação oficial `node scripts/verificar.mjs` voltou a passar: 24 arquivos, nenhuma falha ou teste ignorado, saída zero, em 193,762 segundos. Este resultado é uma conferência funcional, não uma nova comparação de desempenho. O HTML gerado continua com hash `547eebe5bdad827c9a518bc0e415651b54f84dad19f4e9f8a575de858d81d71c`. Os [dados desta verificação](melhorias-iniciais/dados/revisao-suite.json) e sua [saída completa](melhorias-iniciais/dados/revisao-suite.txt) acompanham a branch. Os cabeçalhos HTTP da auditoria original são versionados sem conversão de quebras de linha para preservar seus hashes.
