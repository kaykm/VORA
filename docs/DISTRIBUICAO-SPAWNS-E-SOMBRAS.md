# Distribuição, reposição e alcance das sombras

Registro da distribuição anterior. Seus totais e a dispersão de objetos foram substituídos por pontos mais espaçados e fixos; o controle de distância das sombras continua válido. Consulte [Progressão e pontos fixos](PROGRESSAO-E-PONTOS-FIXOS.md).

Esta revisão substitui a dispersão genérica dos objetos extras por regiões com função própria. O mundo tem 1.357 recursos do cenário, dos quais 814 estão ativos no nível inicial de spawn, além dos slots temporizados anteriores. Há 466 árvores, 75 bancos, 696 rochas e objetos de apoio. Esses totais incluem o cenário anterior, agora consumível; os estoques restantes são liberados pelas melhorias.

## Colocação e modelos

`src/mundo/recursos-layout.js` prepara o layout em lotes. A geometria compartilhada dos caminhos determina tangente, borda e orientação dos bancos. Bancos olham para a passagem; lixeiras ficam ao lado dos pontos de descanso. O circuito externo acompanha a curva de sua rota. Pedras e troncos anteriores que interceptavam caminhos são reposicionados com verificações de circulação, obstáculos e espaço reservado aos spawns.

Seixos, pedras e blocos menores formam grupos nos taludes, sem ocupar os caminhos. Larguras variam de 4,5 cm a 1,8 m, com escala nos três eixos e rotação variadas. Quatro blocos de 4,8 e 7,2 m ocupam as grandes clareiras. Árvores novas e madeira caída formam bordas de bosques. Caixas, barris, paletes, vasos de terracota e pilhas de troncos ocupam pátios de manutenção: seguem a orientação dos acessos, com pequenas variações dentro de cada grupo.

Os cinco modelos de apoio são construídos por `makeResourceProp()` e compartilham o cache de malhas do parque. Também podem ser consumidos: madeira usa os feixes existentes no índice 4, metal usa latinhas e vasos usam o item portátil correspondente. Volume de carga e abertura continuam sendo requisitos de coleta. Pedras pequenas deixam de ser desenhadas quando sua projeção fica abaixo de aproximadamente 1,25 pixel; a coleta continua disponível.

## Melhorias e reposição

Quinze regiões de recursos se distribuem pelos níveis de spawn 0 a 6. Cada melhoria abre regiões e/ou densifica estoques nas regiões existentes. As grandes rochas são liberadas no nível 4. A interface da melhoria mostra a quantidade de áreas e a redução da espera.

A reposição base depende do objeto: bancos levam 90 segundos, barris 70, árvores 120 mais 0,23 segundo por unidade de altura, pedras 35 mais 0,9 segundo por unidade de raio, e os demais 55 segundos. O nível reduz esses tempos em 7,5% por melhoria, até 45% no nível 6. A mesma proporção é aplicada às contagens já pendentes ao comprar uma melhoria. O tempo só avança durante a simulação da partida.

Um recurso pronto não reaparece dentro do buraco, durante sua animação de queda ou sobre objetos soltos. Árvores consideram o tronco para obstáculos no chão e a copa inteira para manter distância do jogador. Consumo, desbloqueio e reposição invalidam o índice de obstáculos e as sombras.

`state.consumedWorld` continua guardando os IDs consumidos; `state.worldResourceSpawns={version:1,pending:[{id,remaining}]}` guarda as contagens. O carregamento valida IDs e intervalos; saves anteriores com apenas a lista de consumidos recebem uma contagem nova. Dinheiro, níveis, carga, poses, depósito e os slots antigos preservam seus contratos. O snapshot só é gravado depois da preparação dos recursos. Nenhum teste usa saves reais.

## Distância das sombras

Em **Configurações → Imagem → Distância das sombras**, os seis níveis são independentes da qualidade dos mapas e da distância de visão:

| Opção | Chave salva | Alcance no mundo | Metros aproximados |
| --- | --- | ---: | ---: |
| Muito baixo | `very_low` | 220 | 5 |
| Baixo | `low` | 360 | 8 |
| Médio | `medium` | 540 | 11 |
| Alto | `high` | 760 | 16 |
| Muito alto | `very_high` | 1.050 | 22 |
| Ultra | `ultra` | 1.450 | 30 |

O alcance acompanha o alvo da câmera, incluindo deslocamento lateral. A sombra desaparece gradualmente entre 82% e 100% da distância. A projeção do mapa e o descarte de emissores acompanham o alcance; uma margem conserva os emissores necessários enquanto a câmera anda antes de recentralizar o mapa armazenado. O intervalo de profundidade também cresce para incluir copas altas nos perfis maiores; bias, reconstrução dos emissores e filtragem usam o mesmo intervalo normalizado. Trocar somente a distância não realoca texturas. O ajuste reduz o alcance de sombras solares, sem alterar a oclusão ambiente.

Uma preferência ausente ou inválida recebe Alto. Escolhas válidas sobrevivem ao carregamento e ao reinício do progresso. Presets incluem a nova preferência; assinaturas antigas com cinco ou seis campos são estendidas sem reaplicar o preset. Ajustes individuais marcam Personalizada. No fallback CPU o seletor permanece desabilitado, pois não há mapas solares WebGL.

## Verificação

`tests/layout-spawns-distancia.test.mjs` verifica densidade, orientação conforme o caminho, pedras fora da circulação, cinco novos modelos, desbloqueios, reposição sem aparecer no jogador, aceleração de contagens pendentes, recarga do save, migração e os seis alcances independentes. Também verifica que o descarte dos emissores mantém sombras próximas quando o mapa ainda não acompanhou a câmera.

`verificar.cmd --sem-pausa` passou nos 40 testes com código zero. A referência original manteve o SHA-256 `3f1c416c7ad088dd1444b64c7ce7d6e55fde2ea6f2a341f2794b33286f0bc2df`. A distribuição gerada tem 77 unidades JavaScript e permanece independente de servidor e rede.

O ensaio adicional `scripts/testar-iluminacao.py` executa o shader real na GPU com e sem limite de distância, compara sombras dentro e fora do alcance e verifica a filtragem com projeção de profundidade ampliada. O cenário exportado por `scripts/preparar-paleta.mjs` foi renderizado com `scripts/testar-paleta.py` para conferir os modelos e a disposição na região inicial e nos pátios de apoio/serraria, sem sombras/AO nessa prévia.

Na NVIDIA GeForce RTX 4060 via ANGLE, os ensaios terminaram sem falhas. No fixture de alcance, a diferença máxima foi zero tanto fora do alcance em relação à imagem sem sombras quanto no núcleo em relação às sombras sem limite. A compilação e os contratos de névoa passaram nos 48 programas ES 1.00/3.00 do ensaio adicional `scripts/testar-gpu.py`.

DOM simulado/SoftwareGL valida lógica e contratos; OpenGL ES offscreen valida shaders e geometria rasterizada na GPU. Esses ensaios não comprovam layout de navegador, mouse/toque, FPS ou ausência de stuttering. A inspeção por navegador integrado foi bloqueada pela política de URL da ferramenta; nenhum save real foi lido ou alterado.
