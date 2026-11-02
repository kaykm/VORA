// Exceções explícitas à equivalência textual da reorganização inicial.
// Cada uma tem testes diferenciais em desempenho.test.mjs/equivalencia.test.mjs
// ou contratos de comportamento em carregamento.test.mjs/sombras.test.mjs.
export const changedSources = new Map([
 ['src/jogo/spawns.js', 'Índice espacial conservador e integração da reposição/desbloqueio dos recursos com as melhorias.'],
 ['src/mundo/vegetacao.js', 'Templates/staging incrementais; somente a paleta de plantas e flores muda RGB.'],
 ['src/mundo/caminhos.js', 'Reuso de amostras e cache numérico privado de coordenadas exatas; mesmos bytes, triângulos e materiais.'],
 ['src/fisica/carga.js', 'Broad phase sem autocontatos, corpos de recursos nas dimensões reais, poses compatíveis e reativação quando o fundo muda.'],
 ['src/mundo/base.js', 'Alinhar cobertura, mostrador, bandeja, papel e letreiro da área de vendas.'],
 ['src/mundo/deposito-modelo.js', 'Encaixes da caixa de vendas sem faces superiores sobrepostas; carga preservada.'],
 ['src/mundo/terreno.js', 'Paleta mais viva no gramado, nos caminhos e nos solos; campos e alturas preservados.'],
 ['src/mundo/modelos.js', 'Paletas autorizadas e seleção de LOD compartilhada entre câmera e sombras; geometria e acabamentos preservados.'],
 ['src/interface/qualidade.js', 'Qualidade e distância independentes das sombras, assinatura gráfica migrável e preferência individual.'],
 ['src/jogo/nova-partida.js', 'Preservar a preferência de sombras ao reiniciar o progresso.'],
 ['src/graficos/iluminacao.js', 'Alvos de sombra por perfil e limites do aparelho durante o boot.'],
 ['src/graficos/sombras.js', 'Qualidade/alcance independentes de AO, projeção adaptada, troca incremental cancelável e filtro estável.']
]);
// As unidades abaixo são verificadas pelos contratos de boot/streaming em
// carregamento.test.mjs; a referência congelada não deve ser regravada.
for(const [file,reason] of [
 ['src/jogo/iniciar.js','Entrada do driver incremental de inicialização.'],
 ['src/jogo/salvamento.js','Adiar a escrita dos defaults até concluir a inicialização.'],
 ['src/jogo/persistencia.js','Impedir snapshots incompletos durante carregamento ou falha.'],
 ['src/jogo/loop.js','Executar recursos pendentes com orçamento entre quadros.'],
 ['src/jogo/camera.js','Interromper a partida e preservar save se houver perda do contexto gráfico.'],
 ['src/jogo/teclado.js','Bloquear movimento/atalhos do mundo e foco da cena enquanto carrega.'],
 ['src/mundo/parque-ampliado.js','Distribuição/horizonte incrementais; modelo das placas e paleta RGB da forração autorizados.'],
 ['src/graficos/programa.js','Preparar o programa principal em passos e vincular os uniforms dos filtros de sombras.'],
 ['src/graficos/imagem.js','Preparar passes de imagem e SMAA em etapas com cleanup.'],
 ['src/graficos/oclusao.js','Preparar programas em etapas e perfis de AO com contato mais discreto e preciso.'],
 ['src/graficos/texturas.js','Gerar a mesma textura procedural em blocos com devolução de controle.'],
 ['src/mundo/vegetacao-render.js','Solicitar recursos fora do render síncrono e limitar cache.'],
 ['src/graficos/cena.js','Preparar sombras sem bakes síncronos e respeitar o perfil solar independente de AO.'],
 ['src/graficos/malhas.js','Preparação incremental e contabilidade/liberação de malhas.']
])changedSources.set(file,reason);
for(const file of ['jogo/medidas.js','jogo/tipos.js','jogo/geracao.js','jogo/coleta.js','jogo/simulacao.js','interface/inventario.js','interface/interior.js'])changedSources.set('src/'+file,'Recursos do mundo consumíveis, madeira e compatibilidade dos objetos antigos.');
for(const file of ['jogo/melhorias.js','interface/spawns.js'])changedSources.set('src/'+file,'Melhorias de spawn abrangem recursos, desbloqueios e velocidade de reposição.');
changedSources.set('src/jogo/melhorias.js','Melhorias de spawn e preservação da distância da câmera ao comprar raio, para não ocultar o crescimento da abertura.');
changedSources.set('src/graficos/carga.js','Desenhar o modelo coletado com a mesma pose e escala do corpo físico, sem substituição por um material minúsculo.');
changedSources.set('src/interface/hud.js','Aviso acessível e barra de carga em alerta quando a pilha física enche a borda.');
changedSources.set('src/interface/layout.js','Janela responsiva do dossiê, escala e inicialização de controles de consulta.');
changedSources.set('src/interface/interior.js','Material de madeira e posicionamento da inspeção no canto inferior esquerdo, respeitando escala e joystick.');
export const newSources=new Map([
 ['src/graficos/sombras-lod.js','Invalidar o mapa estático quando muda a silhueta efetivamente usada pelos modelos e pela vegetação.'],
 ['src/graficos/sombras-limites.js','Resumo conservador de profundidade por blocos, cache do mapa estático e fallback de filtragem completa.'],
 ['src/graficos/visibilidade-gpu.js','Especialização opaca, cobertura de profundidade e volumes conservadores de visibilidade da luz.'],
 ['src/graficos/cache-cena.js','Cache de apresentação com invalidação por estado visível, animações e recursos; overlay e simulação independentes.'],
 ['src/graficos/instancias.js','Agrupamento opcional de malhas idênticas em WebGL 2/ANGLE, preservando transforms, materiais, LOD e sombras.'],
 ['src/jogo/indice-coleta.js','Broad phase espacial conservadora com candidatos na ordem original da coleta.'],
 ['src/interface/inspecao.js','Inspeção por pressão com partículas, silhueta da malha real, câmera suave, parallax e anotações ligadas ao objeto.'],
 ['src/jogo/progressao.js','Economia e lotes medidos, migração de carga/caixa e seis novas melhorias.'],
 ['src/jogo/limite-fps.js','Limite selecionável da cena sem alterar o passo da simulação.'],
 ['src/interface/expansao.js','Skill tree vazia, melhorias adicionais e inspeção geométrica ao segurar por dois segundos.'],
 ['src/interface/dossie.js','Catálogo de malhas reais, avaliação de coleta sem mutações e navegação de exemplares.'],
 ['src/mundo/recursos-layout.js','Regiões autorais, rotação contextual, novas famílias de objetos e estoques desbloqueáveis.'],
 ['src/jogo/recursos-mundo.js','Recursos persistentes, novos detalhes consumíveis e queda da vegetação.'],
 ['src/jogo/carregamento-estado.js','Estado e apresentação do carregamento antes de ler o save.'],
 ['src/graficos/recursos.js','Fila de recursos, orçamento de trabalho e cache limitado.'],
 ['src/mundo/preparacao.js','Preparação incremental de vegetação e recursos de cena.'],
 ['src/jogo/carregamento.js','Etapas reais e driver assíncrono do boot.']
]);
export const changedShaders = new Set(['vertexSource','fragmentSource', 'AO_HORIZON_SOURCE', 'AO_DENOISE_SOURCE', 'TERRAIN_ALBEDO_GLSL']);
changedSources.set('src/graficos/compatibilidade.js','O terreno do fallback acompanha o deslocamento vertical da lente durante a inspeção em telas estreitas.');
changedSources.set('src/graficos/animacao-cena.js','Zoom próximo reservado à inspeção, com limites habituais preservados ao voltar ao jogo.');
for(const file of ['jogo/estado.js','jogo/deposito.js','interface/menus.js'])changedSources.set('src/'+file,'Rebalanceamento autorizado, medições por lote, novas melhorias e superfícies de inspeção.');
changedSources.set('src/interface/animacoes.js','Réguas visuais uniformes de 20 traços, com progresso e animação proporcionais ao limite real de cada melhoria.');

changedSources.set('src/mundo/buraco.js','Reutilizar derivadas já calculadas no contato entre parede e fundo.');
changedSources.set('src/graficos/malha-buraco.js','Malha low poly com 48 setores e menos anéis, preservando o perfil analítico e a física.');
