# Entregas e reprodução

O [relatório da implementação](../MELHORIAS-INICIAIS-TESTES-E-CARREGAMENTO.md) registra resultados e critérios. A [auditoria original](../AUDITORIA-TESTES-E-CARREGAMENTO.md) permanece intacta.

## O que está aplicado

- `entregas/01-testes.patch`: as três mudanças nos testes da cópia principal. Todas as asserções e cenários existentes foram mantidos.
- `entregas/02-cache-caminhos-PENDENTE.patch`: cache numérico dos caminhos, seus testes, oráculos e documentação. **Não está aplicado às fontes nem ao HTML principal.** A palavra PENDENTE identifica a exigência de validação real antes de adoção.

Os dois patches usam a referência `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22` e podem ser examinados separadamente. O segundo também pode ser aplicado depois do primeiro. Os testes do candidato usam hashes capturados antes da otimização, sem modificar o backup congelado.

As medições foram entregues inicialmente sem push, PR, publicação ou merge. Posteriormente, o usuário solicitou o envio da branch `perf/testes-carregamento-inicial` para revisão. A branch aplica somente as melhorias dos testes; o cache permanece como patch pendente. Não aplique esse patch à distribuição principal como consequência de os testes de Node passarem.

## Mapa dos dados

| Caminho | Conteúdo |
| --- | --- |
| `dados/reference.json`, `environment.json` | Commit fixado, correspondência com a auditoria, ambiente e limitações |
| `dados/testes-par-*` | Cinco pares alternados do conjunto piso/sombras/carregamento, antes/depois |
| `dados/isolado-*`, `ordem-inversa.*` | Arquivos afetados individualmente e juntos em ordem inversa |
| `dados/suite-testes.*` | Suíte oficial de 24 arquivos na cópia principal |
| `dados/cache-par-*`, `suite-cache.*`, `replay-*` | Primeira variante experimental, com cache textual por linha; **reprovada por memória** |
| `dados/cache-limitado/` | Segunda variante textual com limite de entradas; **reprovada por memória** |
| `dados/cache-numerico/` | Candidato final isolado: capacidade numérica fixa, amostras, replays e suíte de 25 arquivos |
| `dados/resumo-cache-sem-limite.json`, `resumo-cache-limitado.json` | Resumos preservados das variantes rejeitadas |
| `dados/alternativa-*-REPROVADO.patch` | Implementações descartadas; não são as entregas aprovadas |
| `dados/resumo.json` | Resultado selecionado; `candidateDataset` identifica a pasta da variante final |
| `dados/*/cache-par-*-amostra.json` | Amostra do jogo com tempo ativo, callbacks, memória até a prontidão e hashes |
| `dados/*/cache-par-*.json` sem `-amostra` | Metadados do comando: duração externa, CPU, memória da árvore e código de saída |
| `dados/*/replay-*-amostra.json` | Movimento/giro/zoom em 1.200 passos, cinco imagens CPU e estado final |
| `dados/candidate-inputs.json`, `html-hashes.json` | Hashes das fontes/HTML que identificam as variantes |
| `dados/synthetic-advanced.json` | Save artificial; não veio de perfil pessoal |
| `dados/integrity-final.json`, `workspace-before.json` | Preservação da auditoria, fontes de produção, backup e distribuição principal; mudanças restritas aos três testes |
| `dados/browser-matrix.json` | Oitenta navegações planejadas e não executadas, quarenta por versão |
| `dados/collection-events.json`, `*-transcript.txt` | Eventos e sequência das execuções |

Os logs originais foram renomeados de `.log` para `.txt` para permitir versionamento. Os caminhos `/tmp/` nos registros identificam o local histórico da coleta. As áreas de trabalho foram movidas para `.tmp/` dentro do projeto; `dados/relocacao.json` relaciona as localizações, com conferência dos hashes.

## Métricas e limites

As durações dos testes usam o total informado pelo Node. `wallS` inclui a observação externa, que consulta os processos a cada 0,5 s e pode acrescentar até aproximadamente esse intervalo ao término. Tempos por arquivo são concorrentes e não devem ser somados para obter o total da suíte.

Nos boots, `activeMs` mede o tempo decorrido dentro dos callbacks, incluindo GC e escalonamento. Os callbacks são drenados imediatamente em DOM simulado/SoftwareGL. Esse campo não mede navegação, primeiro quadro apresentado, espera entre RAFs ou FPS.

Cada amostra de carregamento usa um processo novo. `maxRssBootKiB` é a marca de máximo de RSS do processo até a prontidão, antes de serializar os snapshots. `heapMaxSampled` e `rssMaxSampled` são observações depois dos callbacks, que podem perder picos intermediários. O RSS externo da árvore inclui páginas compartilhadas. Não houve GC forçado, e essas métricas não representam memória de GPU.

As variantes não tiveram suas amostras misturadas. A comparação final usa cinco pares completos por save; as anteriores permanecem disponíveis como rejeitadas. Os critérios de 10% de redução de tempo ativo, no máximo 10% de aumento de memória e os critérios reais de navegador não foram relaxados.

Os replays têm vinte segundos virtuais, cinco renders CPU e hashes de cada imagem. Há uma execução por variante/save, suficiente para a checagem determinística descrita, sem repetição para aprovar desempenho depois do boot. `browserP95FrameMs` permanece ausente. As suítes completas finais são aprovações funcionais, não cinco pares de medição da suíte inteira.

## Reproduzir o candidato final em cópias descartáveis

Requisitos: Linux com `/proc`, Git, Node e Python, usando preferencialmente as versões registradas em `environment.json`. Os instrumentos usam bibliotecas padrão, sem pacotes npm. A referência Git já realocada em `.tmp/auditoria-base` contém o commit fixado e é usada por padrão; a pasta principal fornecida nesta sessão não tinha metadados Git utilizáveis. É possível indicar outro clone como argumento, mantendo as novas cópias dentro do projeto.

Execute:

```bash
cd /home/jp/Projects/Vora
python3 docs/melhorias-iniciais/coleta/reproduzir.py
```

O programa cria uma pasta nova em `.tmp/repro-melhorias-*` dentro deste projeto, exporta o commit para três cópias, aplica os patches somente nas cópias e gera seus HTMLs. Sem o argumento de clone, usa a referência já realocada em `.tmp/auditoria-base`. A referência informada é apenas lida. Em seguida executa:

1. Cinco pares alternados dos três arquivos de teste, com concorrência dois.
2. Verificações individuais, ordem inversa e suíte completa da alteração dos testes.
3. Contratos de cancelamento, erro, isolamento e reconstrução do cache.
4. Cinco pares isolados de carregamento para partida nova e avançada.
5. Replays e comparação de cinco imagens por save.
6. Suíte completa do candidato e cálculo do resumo.

O procedimento demora vários minutos. Não execute outras medições pesadas em paralelo. Diante de falha, preserve o registro e corrija a causa; não substitua asserções ou oráculos pelo resultado do candidato.

A reprodução padrão avalia a entrega final e grava os registros desse único candidato diretamente em `dados/`. A organização em três variantes descrita acima pertence à coleta histórica entregue. Nela, a primeira variante executou a suíte completa antes dos pares; as seguintes a executaram ao final. Os comandos e horários reais estão nos registros. Para reproduzir uma alternativa rejeitada, use seu patch em outra cópia do mesmo commit e o mesmo protocolo; não combine suas amostras com as do candidato final.

Os preparadores em `coleta/preparar-cache*.py` documentam a derivação experimental e pressupõem a organização da coleta original. A reprodução suportada usa os patches completos, que incluem os testes e a documentação finais. `entregar.py` é o consolidador desta sessão, com destinos locais fixos; não é necessário executá-lo para reproduzir as medições.

Para recalcular o resumo entregue, copie `dados/` para uma nova subpasta em `.tmp/` deste projeto e execute `coleta/resumir.py` apontando para essa cópia. O script seleciona a variante numérica completa quando disponível e conserva as alternativas em suas próprias pastas.

Para verificar os arquivos da entrega, a partir de `docs/`:

```bash
sha256sum --check melhorias-iniciais/SHA256SUMS
```

## Validação real ainda obrigatória

Usar perfis descartáveis e comparar a referência com uma prévia Pages autorizada do HTML candidato, com o mesmo hash registrado. A versão publicada anteriormente não valida o candidato. Para offline, abrir o HTML por `file://`; HTTP é outra modalidade.

São cinco pares de primeira abertura/recarga para cada combinação Pages/offline e partida nova/avançada: quarenta navegações por versão. Fixar navegador, GPU/driver, resolução, configurações e câmera; alternar a ordem das versões. Medir desde a navegação até a primeira apresentação jogável e observar vinte segundos reais de movimento, giro e zoom, nos mesmos pontos de captura.

Antes de incorporar o cache, exigir primeiro quadro mais cedo em pelo menos quatro dos cinco pares de cada combinação, ausência de regressão funcional/visual, aumento mediano de memória de no máximo 10% e piora mediana de p95 de no máximo 5%. Registrar métricas indisponíveis como ausentes. Se o acesso a perfil descartável, `file://`, prévia ou medição continuar bloqueado, a adoção permanece pendente, sem substituir a prova por Node ou contornar a restrição.


## Localização atual e checagem offline

A área desta implementação está em `.tmp/melhorias-iniciais/`, dentro do projeto. O candidato fica em `experimentos/cache-numerico/` dessa área. As referências anteriores estão em `.tmp/auditoria/` e `.tmp/auditoria-base/`. Nenhum desses diretórios continua em `/tmp/`.

A tentativa de navegação `file://` foi bloqueada pela política da ferramenta, antes de abrir o jogo; consulte `dados/file-validation-attempt.json`. Não houve execução do jogo por esse protocolo nem substituição da prova por outro protocolo. `dados/pacote-offline.json` registra somente as verificações de estrutura e publicação que passaram após a realocação, com recursos embutidos e hashes preservados. A validação real continua pendente.

## Reprodução em um clone da branch de revisão

A pasta `.tmp/auditoria-base` é uma referência local da coleta e não é versionada. Em um clone desta branch, use o próprio clone como referência Git, executando a partir da raiz:

```sh
python3 docs/melhorias-iniciais/coleta/reproduzir.py .
```

O commit auditado precisa estar disponível no histórico local; clones rasos precisam conter `f9fcbccdeaf4fc22f07862eb44f1c7c486926d22`. As cópias e resultados novos continuam dentro de `.tmp/`, e não alteram as evidências históricas entregues.
