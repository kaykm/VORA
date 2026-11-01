# Dossiê de itens e posição do interior

Registro da primeira versão do dossiê. A revisão atual agrupa rotações e cores, limita árvores/pedras a três portes e permite inspecionar o objeto diretamente no mapa. Leia [Progressão e pontos fixos](PROGRESSAO-E-PONTOS-FIXOS.md) para o comportamento atual.

Em **Carga → Dossiê de itens**, a consulta reúne os cinco itens/materiais portáteis e as onze famílias consumíveis do cenário. Ela mostra os modelos do jogo, o parecer para o buraco atual, dimensões, raio mínimo, nível de raio correspondente, material produzido, volume da carga e valor de venda. O feixe de madeira é identificado como material obtido ao consumir árvores e objetos de madeira.

## Catálogo e coleta

Busca desconsidera acentos. Os filtros são Todos, Pode engolir e Precisa crescer. Os botões anterior/próximo percorrem as variações dos portáteis e os exemplares reais das famílias do cenário, ordenados por tamanho. Os filtros também se aplicam aos exemplares navegados: ao escolher Precisa crescer, a prévia mostra um exemplar incompatível com o raio atual.

O parecer consulta `canSwallow()`, `pickupSize()` e `pickupVolume()`, com a mesma tolerância e arredondamento de carga usados na simulação. Ele distingue abertura pequena, falta de espaço, spawn bloqueado por melhoria e recurso aguardando reposição. A disponibilidade informa região, nível de desbloqueio ou contagem restante. As informações são recalculadas ao abrir o dossiê; a partida fica pausada como nos outros menus. A consulta não engole itens nem modifica moedas, carga, spawns ou saves.

Os exemplares do cenário retêm referências aos objetos de coleta atuais. `dossierModel()` reutiliza as malhas e variantes de `getModelMesh()`/`parkPropMeshes`, aplicando a altura da árvore, a escala visual e o alongamento das pedras. Dimensões são os limites da malha escalada em metros; não representam o espaço ocupado pelo material portátil depois da coleta. A miniatura se ajusta à janela para permitir inspecionar tanto seixos quanto árvores e rochas enormes.

## Prévia e interface

Arraste a miniatura para girar horizontal/verticalmente. Roda do mouse, botões e teclas +/− ajustam o zoom. Setas giram a vista e Home a restaura. Os controles também aceitam arraste por toque. O botão Voltar à carga retorna ao inventário e restaura foco no acesso ao dossiê. Escape fecha o menu com o comportamento existente.

Uma instância privada do renderizador `SoftwareGL` existente desenha somente a malha selecionada com teste de profundidade. Isso preserva a geometria e impede que tampas, tiras e faces escondidas atravessem a frente do objeto. A prévia usa iluminação de inspeção sem os efeitos de pós-processamento da cena principal; não promete identidade de pixels com o WebGL. Ela não compila shaders, não cria outro contexto GPU e não mantém um loop de animação. Pedidos de desenho no mesmo frame são compartilhados; a resolução fica limitada a duas vezes o tamanho lógico por eixo. O renderizador principal não é alterado.

O dossiê segue a escala de interface 40–160%, foco e animações do tema. Em janelas estreitas, as famílias passam para uma faixa horizontal e os detalhes ficam abaixo. O painel tem rolagem interna para conteúdo que não caiba. CSS é acrescentado em `estilos/dossie.css`, após a cascata existente. `scripts/fontes.json` contém a unidade uma vez e o template embute o componente; o HTML final continua único e offline.

## Interior no canto inferior esquerdo

`fitInsidePanel()` ancora a base da inspeção à parte inferior esquerda da área segura do viewport. A janela normal e ampliada preservam escala e limites da tela. No desktop a margem inferior é de 12 pixels físicos; no toque reserva-se uma faixa para manter o joystick acessível. Corte, raios X, giro, zoom e a carga física continuam usando o mesmo sistema de inspeção.

## Verificação

`verificar.cmd --sem-pausa` concluiu com código zero: 45 testes passaram. O HTML final tem 78 unidades JavaScript e quatro estilos, com geração determinística. O hash da referência original permaneceu `3f1c416c7ad088dd1444b64c7ce7d6e55fde2ea6f2a341f2794b33286f0bc2df`.

`tests/dossie-interior.test.mjs` valida a âncora inferior nas escalas 40/100/160%, ampliação e área segura; navegação Carga/Dossiê, Escape e foco; ausência de gravações ou mudanças no progresso; parecer consistente com a coleta; filtros de exemplares; uso das mesmas malhas, escalas e variantes capturadas dos draws do mundo; pixels visíveis e desenho sob demanda.

As exceções de equivalência isolam somente o novo componente, seu botão, estilo e as funções autorizadas. Os estilos anteriores e o restante da interface continuam comparados com a referência congelada.

As prévias dos 16 modelos foram exportadas pelo próprio renderizador do dossiê e conferidas visualmente. Para repetir em um ambiente de desenvolvimento Windows:

```powershell
node scripts/inspecionar-dossie.mjs
.\scripts\renderizar-dossie.ps1
```

O primeiro comando grava os framebuffers em `tests/resultados/dossie-*.png`; o segundo apenas monta uma prancha de comparação com legendas usando GDI+ local, sem instalar pacotes. O resultado é `tests/resultados/dossie-previas.png`.

A tentativa de inspecionar o jogo no navegador integrado foi bloqueada pela política de URL para `file://`. Os testes de lógica/posição usam DOM simulado; as imagens são da prévia CPU real. Esses resultados não comprovam layout HTML em navegador, entrada física por mouse/toque, desempenho da GPU ou FPS. Nenhum save real foi acessado.
