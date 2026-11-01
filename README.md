# VORA — projeto local

O jogo está organizado em `C:\Vora`. A referência recebida foi **VORA (17).html**; a cópia original permanece intacta em `backup/VORA-original-17.html`. Nada foi publicado ou enviado ao GitHub.

## Para jogar

O mundo usa pontos fixos de coleta, com pedras, árvores, bancos, troncos, lixeiras, caixas, barris, paletes, vasos e pilhas de madeira. A distribuição foi espaçada: bancos acompanham caminhos e cada item retorna ao próprio ponto. Tamanhos diferentes produzem volumes e valores diferentes, preservados na carga, na caixa e no save. Veja [Progressão e pontos fixos](docs/PROGRESSAO-E-PONTOS-FIXOS.md).

Abra **Carga → Dossiê de itens** para consultar os tipos e seus portes, sem repetir rotações como modelos. Segure um objeto do mapa por **2 segundos** para enquadrá-lo e consultar seu valor, litragem, dimensões e condições de coleta. A inspeção do interior fica no canto inferior esquerdo; em telas de toque reserva espaço para o joystick.

**Configurações → Imagem → Limite de FPS** começa em 60 e oferece 75, 90, 120, 144, 180 e Ilimitado. Melhorias inclui seis novas linhas de progressão e oito níveis da caixa. O botão **Skill tree**, entre Base e Melhorias, abre por enquanto somente uma tela vazia com fundo escurecido e desfocado.

1. Abra a pasta `C:\Vora\dist` no Explorador de Arquivos.
2. Dê dois cliques em **VORA.html**. Escolha seu navegador habitual se o Windows perguntar.
3. Jogue normalmente. Internet, servidor, Node.js e instalação de pacotes **não são necessários para jogar**.

O arquivo `dist/VORA.html` contém todo o jogo: código, estilos, shaders, fonte e ícones. Pode ser copiado sozinho para outra pasta ou computador. O progresso fica no navegador; não acompanha o HTML. Antes de mudar o arquivo de lugar, leia [Saves e mudança de caminho](docs/SAVES.md).

Ao abrir, aguarde a tela **Preparando seu parque** chegar ao fim. A porcentagem acompanha etapas reais de preparação. Modelos, caminhos, iluminação e vegetação são preparados em blocos; o jogo mantém um cache limitado e prepara novos detalhes em segundo plano ao explorar. Não é necessário começar uma partida nova. Veja [Carregamento e travamentos de câmera](docs/CARREGAMENTO.md).

Em **Configurações → Imagem**, **Qualidade das sombras** oferece Desligadas, Baixa, Média, Alta e Ultra. O novo ajuste **Distância das sombras** oferece Muito baixo, Baixo, Médio, Alto, Muito alto e Ultra, independentemente da qualidade e da distância de visão. A oclusão de ambiente continua independente, com Desligada, Leve, Equilibrada e Alta. As escolhas ficam salvas. Veja [Sombras e oclusão de ambiente](docs/SOMBRAS-E-OCLUSAO.md) para os perfis, testes e limites.

Os perfis Alta e Ultra aproveitam um resumo do mapa de sombras para evitar cálculos repetidos em regiões uniformes. As bordas conservam o filtro completo. A [pesquisa de desempenho da GPU](docs/GPU-SOMBRAS-CONSERVADORAS.md) registra medições, custo de memória e limites dos testes.

A [revisão de luz e materiais](docs/REVISAO-LUZ-E-MATERIAIS.md) corrige a diferença de LOD entre árvores e sombras, inclui calçadas e vegetação baixa nas sombras e atualiza o AO e os materiais procedurais.

Os modelos da área de vendas e das placas receberam ajustes de alinhamento e acabamento. Veja [Área de vendas e placas](docs/MODELOS-VENDAS-E-PLACAS.md) para os detalhes e as vistas de conferência.

A área de vendas tem cobertura terracota, estrutura azul-petróleo e madeira quente; o texto **VENDAS foi removido**. O parque mantém verdes mais vivos, flores coloridas e caminhos em arenito quente.

## Para gerar depois de uma alteração

1. Edite os arquivos de `src` ou `assets`.
2. Dê dois cliques em **gerar.cmd**, na raiz da pasta.
3. Aguarde a mensagem de sucesso. Reabra ou atualize `dist/VORA.html` no navegador.

**Não edite `dist/VORA.html` manualmente:** ele será substituído na próxima geração. Se a validação das fontes falhar, a distribuição anterior é preservada.

A geração usa apenas os módulos que já vêm com Node.js. Este computador possui Node.js **24.22.1** no runtime local do Codex; os comandos procuram `node.exe` no PATH e depois nesse runtime. Não é preciso executar `npm install`. Em outro computador, use Node.js 22 ou superior para desenvolver. O navegador continua suficiente para jogar.

## Para verificar

Dê dois cliques em **verificar.cmd**. O comando gera novamente o jogo e executa os testes. A janela mostra o resultado e espera uma tecla antes de fechar. A suíte completa pode levar alguns minutos, dependendo da máquina.

No PowerShell, os equivalentes são:

```powershell
cd C:\Vora
.\gerar.cmd --sem-pausa
.\verificar.cmd --sem-pausa
```

Com Node no PATH, também pode usar `node scripts/gerar.mjs` e `node scripts/verificar.mjs`. Os `.cmd` funcionam mesmo quando iniciados de outra pasta.

Os testes usam a cópia original como referência e um DOM simulado para executar a lógica real, sem baixar ferramentas. Eles também renderizam a cena com o renderizador por CPU já presente no jogo. Geram `tests/resultados/comparacao.json`, `original-cpu.png` e `vora-cpu.png`. Esses resultados são descartáveis e não precisam ir ao Git.

## Onde trabalhar

| Pasta/arquivo | Conteúdo | Editar? |
| --- | --- | --- |
| `src/interface/` | Menus, HUD, interior, animações, componentes HTML e CSS | Sim |
| `src/graficos/` | WebGL, fallback CPU, sombras, AA, FSR e AO | Sim |
| `src/graficos/shaders/` | Shaders legíveis em GLSL | Sim |
| `src/mundo/` | Terreno, parque, modelos, vegetação e buraco | Sim |
| `src/fisica/` | Corpos da carga, apoios e contato com a base | Sim |
| `src/jogo/` | Estado, saves, controles, coleta, economia e spawns | Sim |
| `assets/` | Fonte WOFF, ícones SVG, tabelas SMAA e licenças | Sim, preservando formato/licenças |
| `scripts/fontes.json` | Ordem explícita das fontes na geração | Sim, com cuidado |
| `scripts/compilar.mjs` | Gerador sem dependências externas | Sim |
| `tests/` | Verificações e ambiente de simulação | Sim |
| `docs/` | Mapa da arquitetura e registro da entrega | Sim |
| `dist/` | HTML e manifesto gerados | Não |
| `backup/VORA-original-17.html` | Referência imutável e cópia de segurança | Não |

Veja [Arquitetura](docs/ARQUITETURA.md), [Verificações e limitações](docs/VERIFICACAO.md) e [Regras de desenvolvimento](AGENTS.md). `docs/ORIGEM.json` associa os arquivos JS às linhas do HTML recebido e registra seu SHA-256.

## O que foi preservado

O renderizador, mundo ampliado, modelos, física, economia, controles, interior e ADM continuam usando a implementação recebida. A interface mantém tema escuro, ícones, correções de hover/contorno, tamanhos próprios, escala de 40% a 160%, ajustes avançados recolhidos e todas as opções de imagem. Uma partida nova começa em resolução nativa, FSR/AA/AO desligados.

Na migração de preferências, um save válido antigo sem `nativeDisplayDefaultsV1` conserva suas escolhas. Os mecanismos existentes de verificação de suporte gráfico continuam ativos.

Na atualização seguinte, a composição de oclusão e névoa foi corrigida para eliminar contornos distantes. Também foram otimizadas a busca de obstáculos dos spawns, a preparação de vegetação/caminhos e a física de um único corpo, preservando densidade, modelos e saves. Veja [Névoa, desempenho e testes na GPU](docs/NEVOA-E-DESEMPENHO.md).

A atualização de sombras/AO substitui a integração de horizonte por oclusão de contato limitada à luz ambiente, com reconstrução que respeita profundidade e normais. Os mapas solares têm qualidade independente e sua troca é preparada pela fila progressiva de recursos. O perfil de sombras padrão é **Alta**, mantendo as resoluções anteriores de desktop e celular; escolhas válidas de AA, AO e reconstrução continuam preservadas.

O teste gráfico adicional é opcional: `testar-gpu.cmd` usa Python e uma instalação local de ANGLE, sem abrir navegador ou acessar saves. Neste computador ele foi executado com as bibliotecas já instaladas do Steam. `verificar.cmd` continua precisando somente de Node. Para repetir as medições de CPU, execute `node scripts/medir.mjs`; os resultados ficam em `tests/resultados/desempenho.json`.

## Preparação para GitHub

Fontes, recursos, documentação, scripts, testes e a referência original congelada podem ser versionados. `dist`, resultados temporários, dependências e outros backups ficam fora pelo `.gitignore`. A referência original é incluída deliberadamente para tornar os testes comparativos reproduzíveis. Nenhum recurso necessário à geração depende do backup. A geração não exige conta, repositório remoto ou conexão.
