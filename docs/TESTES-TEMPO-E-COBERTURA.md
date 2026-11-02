# Tempo e cobertura dos testes automatizados

Este documento registra a primeira etapa, limitada aos testes. A continuação que também otimiza a preparação do mundo e o agendamento está em [Carregamento e tempo de resposta](CARREGAMENTO-E-TEMPO-DE-RESPOSTA.md); seus dados não substituem os resultados históricos abaixo.

Revisão de 1º de novembro de 2026. O escopo é o executor de testes: nenhuma fonte do jogo, shader, recurso, física ou save foi alterado por esta revisão.

## Diagnóstico

A suíte prepara muitos ambientes independentes do jogo. O custo relevante está em gerar o parque, caminhos e modelos, repetidamente; os testes estáticos de fontes, manifesto e backup custam pouco. Compartilhar um mundo ou DOM mutável entre cenários reduziria o isolamento e não foi adotado.

Foi consultada a branch `perf/testes-carregamento-inicial`, no commit `c79a71ff0e6b7c572a82cc1379a16d714456fafb`. Ela contém uma auditoria e três melhorias de preparação dos testes. Sua base inclui outra refatoração do jogo, posterior à nossa `main`; a branch inteira não foi incorporada. As medições Linux/Node 25 da pesquisa não são usadas como baseline desta revisão Windows/Node 24. O cache de caminhos entregue como pendente naquela pesquisa também não foi adotado.

Ao conferir o harness atual, `nextBoot()` já chama `iterator.next()` diretamente: não há uma nova execução de `vm.runInContext` a cada retomada automática. As chamadas repetidas à VM estão nas consultas de progresso/prontidão do teste manual. Por isso não se alterou `tests/ambiente.mjs` nem a forma como o carregador real é exercitado.

## Alterações e cobertura preservada

| Teste | Preparação removida | O que continua sendo verificado |
| --- | --- | --- |
| `piso-loja` | Boot completo | Predicado de recorte e condição do shader |
| `sombras`: orçamento dos alvos | Boot completo | Limites de textura/depth, orçamento móvel e perfis |
| `desempenho-avancado`: malha do buraco | Boot completo | Perfil analítico, triângulos, índices e normais em quatro tamanhos |
| `borda-cheia`: entrada/salto/calçada | Boot completo | Corpos em queda e altura local não bloqueiam indevidamente |
| `carga-recursos-fisica`: reativação | Boot completo | Corpo em repouso acorda quando o fundo muda |
| `carregamento`: progresso | Uma consulta VM por retomada | Progresso e prontidão lidos juntos; todas as verificações intermediárias permanecem |

Nos cinco primeiros cenários, `boot:'manual'` carrega as declarações reais e prepara apenas o estado necessário ao contrato. Os testes de carregamento completo, driver RAF, coleta, menus, saves, descarga e integração do mundo continuam com sua preparação própria. Nenhum cenário existente foi removido, pulado ou teve asserções retiradas para acelerar.

Foram corrigidos dois pontos fracos:

- O teste de desenho da carga usava `cargoDraws.every(...)`, que também aceita uma lista vazia. Agora exige uma chamada para cada corpo antes de comparar modelo e escala.
- O dossiê comparava a resposta com a mesma função delegada pela implementação. Essa integração permanece, mas passou a incluir uma fronteira independente: lata de 66 mm, folga de 12 mm e raio logo abaixo/acima do mínimo físico.

Quatro novos casos protegem o executor: suíte completa por padrão, seleção exata, rejeição de argumentos inválidos e listagem sem gerar/executar o jogo. A checagem de listagem usa uma pasta temporária isolada, evitando disputar o `dist` com o teste de estrutura.

## Quais testes são necessários

Os testes de saves em `jogo`, economia, recursos e carga física têm sobreposição, mas cobrem contratos distintos: formato antigo, medidas e preços dos lotes, reposição do cenário e pose/modelo do corpo. Foram mantidos. Os testes estruturais baratos também foram mantidos: impedem alterações do backup, duplicações, ciclos, recursos externos e geração divergente.

As verificações por regex de shader e por mocks de GL são úteis como contratos estruturais e de submissão; não demonstram qualidade visual nem ausência de artefatos de profundidade em GPU real. Os nomes históricos de testes gráficos não alteram esse limite. Tempo de suíte não é FPS nem tempo de carregamento no navegador. Não há limite de tempo frágil usado como condição de aprovação funcional.

## Executar somente o trabalho relevante durante uma edição

```powershell
# Antes de entregar: gera e executa TODOS os arquivos, concorrência 2.
verificar.cmd --sem-pausa

# Durante uma edição: seleção explícita; não substitui a verificação completa.
verificar.cmd --sem-pausa --arquivo piso-loja.test.mjs
verificar.cmd --sem-pausa --arquivo jogo.test.mjs --arquivo carga-recursos-fisica.test.mjs

# Conferir a seleção sem gerar nem executar.
verificar.cmd --sem-pausa --listar

# Medir a suíte completa com logs e relatório, sem sobrescrever resultados.
node scripts/medir-testes.mjs --saida minha-medicao
```

Com Node no PATH, as mesmas opções de seleção funcionam em `node scripts/verificar.mjs`. O padrão continua sendo a suíte inteira; nomes desconhecidos, opções inválidas e caminhos externos provocam erro. `--arquivo` pode ser repetido, com nome simples ou `tests/nome.test.mjs`. A geração permanece parte de qualquer execução de testes; só `--listar`/`--help` a dispensam.

## Método das medições desta revisão

A baseline é uma cópia Git isolada de `ecc7b3b096a0e34a80a93b0c934c3cb066977ab2`, sem as otimizações. A baseline e o candidato executaram sequencialmente, na mesma máquina Windows, Node 24.22.1, CPU Ryzen 5 5600, 12 CPUs lógicas e aproximadamente 16 GiB de RAM. A concorrência interna permaneceu em dois processos; não rodamos benchmarks pesados simultaneamente.

Três pares alternados mediram somente os cinco cenários que dispensaram boot. Todos aprovaram os mesmos cinco cenários. O filtro usado foi `^(fundação substitui|alvos respeitam|buraco low poly|objeto entrando|carga adormecida)` nos cinco arquivos correspondentes. Esse resultado não é a duração da suíte inteira. O teste de progresso não entra nesse subconjunto.

As execuções completas incluem geração, processos e todos os testes; o candidato inclui ainda os quatro casos novos do executor. Uma execução completa de cada versão mostra o resultado observado nesta máquina, sem estabelecer uma distribuição estatística da suíte. A carga externa do computador não foi isolada e não se mediram memória, GPU nem desempenho do jogo. Resultados brutos e contagens ficam em `tests/resultados/`; uma síntese acompanha esta documentação.

## Resultados medidos

| Execução completa | Parede, incluindo geração | Duração do Node | Resultado |
| --- | ---: | ---: | --- |
| Baseline | 210,061 s | 209,597 s | 93 aprovados; 0 falhas/ignorados |
| Otimizada | 195,756 s | 195,456 s | 97 aprovados; 0 falhas/ignorados |

A redução observada da execução completa foi **6,8% (14,31 s)**, mesmo com quatro casos novos. É uma comparação completa de cada versão, não uma mediana de várias suítes; variação externa pode influenciar uma diferença dessa ordem. O restante do tempo continua concentrado nas integrações que realmente preparam mundos independentes.

Os três pares do subconjunto selecionado foram:

| Par | Baseline | Otimizado |
| --- | ---: | ---: |
| 1 | 14,657 s | 0,828 s |
| 2 | 14,914 s | 0,876 s |
| 3 | 14,714 s | 0,814 s |

As medianas são **14,714 s → 0,828 s (94,4%)**, com melhora em todos os pares. Isso mede somente os cinco cenários selecionados; não atribui esse percentual à suíte inteira. Nenhuma amostra foi retirada.

O comando Windows direcionado também foi exercitado: `verificar.cmd --sem-pausa --arquivo piso-loja.test.mjs` aprovou seu único teste, com 0 falhas/ignorados e duração do Node de 244 ms (a geração e o wrapper ficam fora dessa duração). A execução padrão pelo wrapper foi a usada no benchmark completo.

A [síntese em JSON](evidencias-tempo-testes.json) conserva as amostras, ambiente, comandos e hashes. O HTML gerado e o harness têm o mesmo hash antes/depois; o backup original permanece intacto. A melhoria não é ganho de FPS nem aceleração do carregamento do jogo.
