# Regras para trabalhar no VORA

## Escopo e fontes

- Trabalhe em `C:\Vora`. Preserve arquivos pessoais e o backup original.
- Edite `src/`, `assets/`, `scripts/`, `tests/` e documentação. `dist/` e `tests/resultados/` são gerados; nunca aplique correções apenas neles.
- `backup/VORA-original-17.html` é a referência congelada desta reorganização. Não modifique seu conteúdo nem seu hash para fazer um teste passar.
- O projeto é JavaScript clássico + WebGL/Canvas, sem framework, CDN ou dependências de npm. Não substitua o renderizador nem acrescente infraestrutura sem necessidade.
- Antes de mudar um sistema, leia `docs/ARQUITETURA.md` e localize suas declarações nas fontes com `rg`.

## Organização e dependências

- `scripts/fontes.json` é a lista única e ordenada das unidades JavaScript e estilos. Inclua cada arquivo JS exatamente uma vez.
- As unidades são fragmentos de um único programa clássico, concatenados na ordem histórica. Não são módulos ES independentes: o escopo lexical compartilhado é intencional para manter `file://` e o comportamento original. Consulte as fases em `docs/ARQUITETURA.md`.
- Não introduza imports de rede, `fetch` de recursos, carregamento assíncrono ou dependências circulares entre inclusões. Recursos devem ser embutidos na geração.
- `state`, declarado em `src/jogo/salvamento.js`, é o estado persistente canônico. `src/jogo/estado.js` contém o estado transitório da partida. Não crie cópias mutáveis paralelas nem reatribua o estado com snapshots desatualizados.
- Preserve a ordem das inicializações no topo dos arquivos e em `src/jogo/iniciar.js`. Funções podem acessar outras unidades em execução; inicializadores `const`/`let` só podem ler declarações já inicializadas.
- Shaders ficam em `src/graficos/shaders/`. Use os marcadores `@text` para strings e `@template` somente quando existirem interpolações `${...}`. Não escape manualmente shaders para uma linha gigante.
- `assets/smaa/lookup.json` descreve as texturas RGBA; os `.rgba` são os bytes da referência, não imagens PNG.
- Preserve a sequência do CSS base e tema: a cascata é parte da aparência. Não remova ajustes aparentemente repetidos sem verificar seus efeitos.
- A névoa compartilhada está em `src/graficos/shaders/nevoa.glsl`. AO deve atenuar a superfície antes da contribuição da névoa; não volte a escurecer a cor final inteira.
- Ao mover/remover/redimensionar obstáculos dentro dos arrays do mundo, invalide `spawnObstacles` com `invalidateSpawnObstacles()`. O cache já acompanha acréscimos e substituição dos arrays.
- Mantenha comentários e licenças de Manrope, Lucide/Feather, SMAA, AMD FidelityFX e Intel XeGTAO nos recursos e no HTML final.
- Inicialização: use os generators em `src/jogo/carregamento.js`. Não volte a compilar programas grandes no topo nem gravar saves antes de `gameLoading.ready`.
- Nunca chame `bakePlantTile()`/`partitionStaticMesh()` para recursos ausentes dentro dos passes de renderização. Solicite a fila em `src/graficos/recursos.js`; builders incrementais devem devolver controle entre lotes e liberar alocações se cancelados.
- O cache de vegetação em `src/mundo/preparacao.js` conta bytes do parent uma vez e preserva uma representação visível durante troca de LOD. Alterações devem manter limite de memória, cancelamento por geração e ausência de tarefas duplicadas.

## Compatibilidade obrigatória

- O único HTML `dist/VORA.html` deve abrir offline pelo Explorador, sem servidor e sem Node para jogar.
- Preserve `localStorage['vora-v1']`, estrutura dos saves, níveis, inventário, poses físicas, depot e estado dos spawns. Mutações de formato precisam de migração testada.
- Não substitua preferências gráficas válidas ao carregar um save antigo. Partidas novas usam `imageMode/outputMode='native'`, `aaMode/aoMode='off'`.
- Preserve mundo ampliado, árvores, vegetação, caminhos, abertura do buraco e o contrato de medidas `WORLD_UNITS_PER_METER=48`.
- Preserve coleta, simulação, base, caixa, economia, melhorias, níveis, spawns, teclado/mouse/toque, interior isométrico/X-ray e funções ADM.
- Preserve tema escuro, SVGs, menus com tamanho próprio e escala de 40–160%, foco, hover, avançados recolhidos, oito faixas de qualidade mais Padrão/Personalizada e alternativas gráficas compatíveis.
- Não leia, limpe nem sobrescreva saves reais do usuário para testar. Use o ambiente determinístico ou um perfil de navegador isolado.

## Verificações antes de entregar

1. Use validação proporcional à alteração para evitar carregar o mundo inteiro em toda resposta. Em alterações locais, execute os arquivos de teste afetados com `verificar.cmd --sem-pausa --arquivo nome.test.mjs` (repita `--arquivo` quando necessário), além de gerar o HTML. Execute a suíte completa `verificar.cmd --sem-pausa` antes de merge/publicação, ao alterar o carregamento, o harness/executor, geração/manifesto, formato de saves ou sistemas compartilhados com impacto amplo, ou quando não houver seleção segura. Registre quais verificações foram feitas; não apresente uma seleção como suíte completa. Se só documentação mudou, valide os links/comandos pertinentes, sem repetir testes do jogo já aprovados. Não repita uma suíte completa aprovada sem nova alteração relevante, falha ou preocupação pendente.
2. A geração deve ser determinística e recusar recursos externos, marcadores pendentes, arquivos repetidos e ciclos de inclusão.
3. Para mudanças de comportamento, acrescente ou adapte testes que validem o resultado relevante. Não use apenas testes que reproduzem a implementação.
4. Os testes de equivalência garantem preservação desta reorganização. Uma melhoria futura autorizada pode alterar a paridade: descreva a mudança e ajuste a asserção específica, mantendo a referência original intacta e os demais contratos.
5. Quando houver navegador acessível, confira a inicialização e os sistemas afetados visualmente, preferencialmente em perfil isolado. Respeite bloqueios das ferramentas; se não for possível, registre a limitação.
6. Diferencie testes em DOM simulado/SoftwareGL de testes reais de layout, GPU e toque. Não apresente o primeiro como prova do segundo.
7. Não afirme ganho de FPS pela separação. Comparações de desempenho exigem a mesma cena, save, câmera, resolução e configurações; informe separadamente FPS, carregamento, memória e chamadas de desenho.
8. Atualize a documentação quando mudar caminhos, dependências, comandos ou contratos. Gere novamente `dist/VORA.html` ao final.

Não publique, envie mensagens externas, faça deploy ou push sem autorização do usuário.
