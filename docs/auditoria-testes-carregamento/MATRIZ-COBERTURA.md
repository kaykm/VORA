# Mapa dos testes auditados

Declarações são contagem estática; helpers e parâmetros podem criar mais ambientes/casos em execução. Manual não significa que o teste nunca drena o boot: carregamento e melhorias também o consomem depois. SoftwareGL e mocks não validam layout/GPU reais. A classificação indica o contrato principal, com sobreposições. Os arquivos chamados desempenho validam resultados e invariantes; as medições comparativas desta auditoria estão separadas e não devem virar limites de tempo frágeis na suíte.

| Arquivo | Tipo principal | Contrato | Declarações | Ambientes observados | Automáticos | Manuais |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| borda-cheia.test.mjs | Integração e lógica do jogo | Histerese da borda, capacidade, bloqueio e descarga | 3 | 3 | 3 | 0 |
| carga-recursos-fisica.test.mjs | Integração e lógica do jogo | Escala/pose dos recursos, colisão e reativação física | 3 | 4 | 3 | 1 |
| carregamento.test.mjs | Integração e lógica do jogo | Progresso, saves parciais, driver de falha, fila/cache e espera KHR | 6 | 6 | 1 | 5 |
| crescimento-buraco.test.mjs | Integração e lógica do jogo | Raio projetado, zoom, compra recusada e restauração | 2 | 3 | 3 | 0 |
| desempenho-avancado.test.mjs | Equivalência e integração gráfica simulada | Índice de coleta, geometria do buraco, instancing e fallback | 5 | 6 | 1 | 5 |
| desempenho.test.mjs | Equivalência de lógica/geometria; tempo separado na auditoria | Índice de spawns, bits de malhas/paleta e física histórica | 3 | 6 | 6 | 0 |
| dossie-interior.test.mjs | Integração e lógica do jogo | Posicionamento calculado, navegação, coleta e malha da prévia | 5 | 5 | 5 | 0 |
| equivalencia.test.mjs | Equivalência histórica e imagem CPU | Interface/recursos e frame CPU sob recortes históricos autorizados | 2 | 3 | 3 | 0 |
| estrutura.test.mjs | Estrutura e geração | Determinismo, backup, manifesto, inclusão e recursos offline | 4 | 0 | 0 | 0 |
| expansao-economia.test.mjs | Integração e lógica do jogo | Volumes/valores, migração, melhorias, FPS e pontos fixos | 8 | 11 | 11 | 0 |
| fluxo.test.mjs | Lógica e integração do loop | Coordenação do frame e generators sem preparar o mundo | 7 | 0 | 0 | 0 |
| gpu-visibilidade.test.mjs | Integração gráfica simulada | Volume de sombra, pré-passe, cache e continuidade da simulação | 6 | 6 | 3 | 3 |
| inspecao.test.mjs | Integração e imagem CPU | Pressão/cancelamento, foco, silhueta, parallax e reconstrução | 6 | 6 | 4 | 2 |
| jogo.test.mjs | Integração e lógica do jogo | Integração geral, saves, armazenamento bloqueado, entrada e menus | 6 | 8 | 8 | 0 |
| layout-spawns-distancia.test.mjs | Integração e lógica do jogo | Distribuição, reposição, migração e alcance de sombras | 4 | 6 | 6 | 0 |
| melhorias-uniformes.test.mjs | Integração de interface simulada | Controles preservados, estrutura dos cartões e réguas | 2 | 2 | 1 | 1 |
| mesh-incremental.test.mjs | Equivalência de dados e lifecycle | Bytes, índices, ranges, lotes e cleanup de buffers | 5 | 5 | 5 | 0 |
| pages.test.mjs | Estrutura de publicação | Entrada relativa e arquivos da publicação | 1 | 0 | 0 | 0 |
| piso-loja.test.mjs | Lógica e contrato de shader | Recorte da calçada, borda/chanfro e uso no shader | 1 | 1 | 1 | 0 |
| recursos-mundo.test.mjs | Integração e lógica do jogo | Árvores/rochas, coleta, venda e restauração dos recursos | 3 | 4 | 4 | 0 |
| sombras-limites.test.mjs | Lógica e posse de recursos | Resumo de sombras, orçamento e posse/cancelamento de recursos | 5 | 5 | 0 | 5 |
| sombras-visuais.test.mjs | Integração gráfica simulada | Malha/LOD entre passes e pedidos iniciais sem duplicação | 5 | 5 | 0 | 5 |
| sombras.test.mjs | Integração e lógica do jogo | Preferências, migrações, alocação e falha de mapas | 6 | 8 | 8 | 0 |
| textura-incremental.test.mjs | Equivalência de bytes | Bytes da textura procedural original e incremental | 1 | 1 | 1 | 0 |

Fonte detalhada: [inventário](dados/inventory.json) e [chamadas observadas](dados/runtimes.ndjson). Nenhum arquivo foi excluído.
