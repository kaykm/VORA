# Revisão de luz, contatos e materiais

Esta revisão corrige a divergência entre árvores visíveis e suas sombras, inclui calçadas e vegetação baixa nos emissores, substitui o AO de hemisfério por uma integração de horizontes e revê os materiais procedurais. O mundo, as dimensões físicas, os modelos, os saves e as escolhas gráficas existentes são preservados. O jogo continua offline em um HTML.

## Causa das manchas nas árvores

`modelDetailAt()` devolvia sempre o LOD 0 durante o passe de sombra. Perto da câmera, a árvore visível usa o LOD 1, que possui outras massas de copa. Como cada nível também é normalizado pela própria altura máxima, a sombra simplificada podia atingir partes do modelo detalhado onde não existe aquele bloqueador. Ao afastar a câmera, o modelo visível voltava ao LOD 0 e a divergência desaparecia.

Os dois passes agora escolhem a mesma malha e a mesma escala. `graficos/sombras-lod.js` inclui a silhueta efetivamente usada na chave do cache. Mover o zoom dentro do mesmo LOD não refaz o mapa; cruzar um LOD ou terminar uma malha que será exibida solicita a atualização. A geometria dos modelos não foi alterada para esconder a diferença.

O receptor de sombras passa a usar a normal do triângulo real, calculada antes dos descartes. A normal suave continua controlando a iluminação estilizada da copa. Assim uma normal suavizada de iluminação não desloca o receptor para uma posição incompatível com sua profundidade facetada. A luz das folhas recebeu uma pequena componente envolvente e transmissão, mantendo os volumes legíveis sem recortes excessivamente escuros.

## Calçada e vegetação baixa

`drawWalkways()` agora participa do mapa estático. Antes a calçada recebia sombras de outros objetos, mas não projetava sua própria sombra junto do meio-fio. Sua malha e sua altura de 11 cm permanecem iguais.

A calçada recebe uma tag própria no mapa de profundidade. O recorte analítico da escavação continua removendo sua contribuição quando o buraco atravessa o caminho; não se cria uma cobertura invisível sobre a abertura. O resumo min/max considera esses blocos ambíguos e conserva o filtro completo.

A vegetação usa no passe de sombra a mesma malha pronta escolhida para a câmera, incluindo tufos e folhas rasteiras. Isso elimina a exclusão explícita das plantas baixas e a necessidade de um segundo bake de geometria só para sombras. A alocação pertence à entrada normal do cache e seus bytes são contados uma vez, mesmo quando o buffer participa dos dois passes.

O carregamento inicial reúne os pedidos por tile/LOD para não construir a mesma malha duas vezes. As solicitações durante o jogo continuam passando pela fila incremental, sem bake síncrono dentro do desenho. Limite de memória, cancelamento por geração e uma representação visível durante a troca de detalhe continuam em vigor.

Folhas baixas projetam uma sombra de contato com 55% de opacidade, aproximando a luz transmitida e espalhada por essa camada fina. Calçadas, troncos, objetos e volumes de copa conservam a sombra sólida. Essa distinção evita que um tapete de folhas pequenas vire uma superfície de recortes pretos.

## AO por horizontes

O shader usa a integração de arcos ponderados pelo cosseno descrita no [trabalho de GTAO de Jimenez e colaboradores](https://research.activision.com/publications/archives/atvi-tr-16-01practical-realtime-strategies-for-accurate-indirect-occlusion). A adaptação mantém o WebGL clássico; não instala um SDK ou troca o renderizador. As considerações sobre espessura e objetos finos da [implementação Intel XeGTAO](https://github.com/GameTechDev/XeGTAO) orientam a compensação dos limites de uma imagem de profundidade.

O novo cálculo pesquisa horizontes nos dois sentidos de cada fatia. O alcance cai gradualmente com a distância e diferenças grandes de profundidade perdem peso, para não tratar uma folha ou silhueta como uma parede infinitamente espessa. Amostras de céu e de fora da tela permanecem abertas. A distribuição concentra mais amostras perto do contato, sem ruído temporal. Na borda da imagem, a reconstrução prefere a diferença válida voltada para dentro da tela; uma normal sem suporte não cria oclusão artificial.

A integração usa o plano reconstruído da profundidade real. O ensaio inicial encontrou auto-oclusão falsa quando usava somente normais suaves sobre uma copa facetada; reconstruir o plano eliminou essa falha sem remover os contatos entre copas.

`shaders/ao-superficie.glsl` concentra reconstrução, codificação e pesos de superfície usados pelo AO, filtro e composição. O filtro confere profundidade, normais e os planos dos dois lados para evitar vazamento escuro nas silhuetas. As normais do buffer da cena representam agora a geometria, sem o relevo decorativo das texturas.

As chaves `off`, `fast`, `balanced` e `high` e os orçamentos de 8/12/24 amostras são preservados. O alcance padrão passa a 12 unidades, 25 cm, com intensidade 0,85. A composição continua limitando a remoção a 42% da fração ambiente; luz direta e contribuição da névoa permanecem preservadas. O desligamento do AO e as preferências dos saves continuam funcionando.

## Materiais

- Calçada com pedra mais neutra, variação discreta entre peças, agregado fino, juntas recuadas e relevo de superfície. O padrão acompanha os caminhos existentes.
- Terra e areia com grão, poros e pequenas diferenças de relevo, mantendo suas regiões e alturas.
- Gramado com menos contraste de ruído fino, preservando as manchas amplas e a paleta viva.
- Grão de superfícies sólidas em coordenadas do próprio objeto, para acompanhar rotação e queda; intensidade ajustada ao acabamento. Folhas conservam sua cor de modelo.
- Madeira com direção de fibra mais alongada; relevo do interior do buraco mais contido, mantendo os estratos e materiais anteriores.

Os detalhes menores que um pixel perdem contraste com a distância. Não há imagens externas nem novas texturas de disco. As funções de cor do fallback CPU acompanham as novas cores do pavimento e dos solos.

## Verificação visual e limites

`preparar-revisao-visual.mjs` captura as submissões reais do mundo em um ambiente determinístico, com os shaders, malhas e matrizes de produção. `testar-revisao-visual.py` rasteriza os mapas de sombras e a cena em GLES nativo, ANGLE/D3D11 na RTX 4060. As vistas incluem câmera próxima, afastada, calçada e um grupo de copas, a 1000 × 760, com sombras Alta e AO Alta. Dois controles adicionais isolam o meio-fio e a vegetação rasteira como únicos emissores.

A referência é `tests/resultados/VORA-visual-antes.html`, a distribuição anterior a esta revisão. O replay usa submissão individual e desliga somente o atalho conservador de filtragem para isolar a aparência. Esses caminhos já possuem regressões próprias de equivalência. Os PNGs separam cena sem sombras, sombras e composição com AO; `revisao-visual-gpu.json` registra parâmetros e contagens.

Resultados desta revisão:

- **83 testes automatizados aprovados**, incluindo LOD coerente, atualização do cache, geometria compartilhada da grama, preparação sem pedidos duplicados, saves, física, economia, interface e geração offline determinística.
- **54 programas GLSL ES 1.00/3.00 compilados**. Névoa e AO preservados nos casos de regressão; o plano aberto ficou com visibilidade 255/255 até as bordas da imagem nas duas linguagens.
- O ensaio dedicado de iluminação terminou com `failures: []`, preservando contatos, a copa isolada exposta, o chão aberto e o céu.
- Nos controles de sombra, a versão anterior apresentou zero pixels de sombra projetada na grama. A nova apresentou **12.838 pixels** no controle de meio-fio e **62.018 pixels** no de relva, com mesma câmera e geometria visível. São contagens dos controles a 1000 × 760, não métricas de FPS.
- As nove comparações nativas de desenho individual/instanciado mantiveram a imagem idêntica. O atalho conservador passou em **90 casos / 2.211.840 fragmentos**; suas cinco comparações de cor e normais, com os materiais atuais, também ficaram idênticas entre atalho desligado e ligado.

O ensaio dedicado de iluminação continua conferindo plano aberto, copa convexa isolada, contatos entre copas, céu, AO desligado, resoluções de AO, filtros de sombra e alcance. Os arquivos ficam em `tests/resultados/iluminacao-*.png` e `iluminacao-gpu.json`. O teste do resumo de sombras pode usar `--isolate-bounds` para comparar os mesmos materiais novos com o atalho desligado e ligado, em vez de exigir igualdade com uma aparência antiga autorizada a mudar.

Esses ensaios executam shaders na GPU. Eles não comprovam layout, entrada por toque, FPS, temperatura ou potência do aplicativo inteiro. A política da ferramenta continua bloqueando o HTML local no navegador; o bloqueio não foi contornado. Saves reais não foram acessados.

A vegetação baixa agora efetivamente projeta sombra, portanto o passe estático pode enviar mais triângulos. Ele continua em cache, e a geometria visível não é duplicada em memória para essa finalidade. Os tempos do relatório anterior de otimização são históricos; esta revisão de qualidade não afirma ganho de FPS.

```powershell
node scripts/preparar-revisao-visual.mjs tests/resultados/VORA-visual-antes.html
python scripts/testar-revisao-visual.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
node scripts/preparar-gpu.mjs tests/resultados/VORA-visual-antes.html
python scripts/testar-iluminacao.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
node scripts/preparar-sombras-limites.mjs tests/resultados/VORA-visual-antes.html --isolate-bounds
python scripts/testar-sombras-limites.py --angle-dir "C:\Program Files (x86)\Steam\bin\cef\cef.win64"
.\verificar.cmd --sem-pausa
.\gerar.cmd --sem-pausa
```
