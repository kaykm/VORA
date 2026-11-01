# Publicação no GitHub Pages

O site usa **Deploy from a branch**, com a branch **main** e a pasta **/(root)**. A entrada pública é [kaykm.github.io/VORA/](https://kaykm.github.io/VORA/).

`index.html`, na raiz do repositório, encaminha o navegador para `./dist/index.html`. O endereço relativo preserva o prefixo `/VORA/` e também funciona em um domínio próprio. O link “Abrir VORA” permite navegar se o redirecionamento estiver desativado. Os dois endereços usam a mesma origem, preservando o armazenamento do progresso no navegador.

`.nojekyll`, também na raiz, faz o Pages servir os arquivos estáticos diretamente. O jogo já é um HTML completo: não precisa da transformação do Jekyll. Renomear somente `dist/VORA.html` para `dist/index.html` não fornece uma entrada na raiz publicada.

## Atualizar o site

1. Altere as fontes em `src/` e os recursos em `assets/`.
2. Execute `verificar.cmd --sem-pausa` no Windows ou `node scripts/verificar.mjs` com Node no PATH. Esse comando gera a distribuição e executa os testes.
3. Confira as alterações e envie as fontes e a distribuição atualizada para `main`, quando a publicação estiver autorizada. `dist/index.html` e `dist/manifesto.json` já são rastreados no repositório; o `.gitignore` não os exclui das atualizações.
4. Aguarde a execução **pages build and deployment**, na aba Actions, terminar com sucesso. Ela deve corresponder ao commit enviado.
5. Abra o endereço público. Ele deve encaminhar para `/VORA/dist/index.html` e apresentar o jogo.

`index.html` e `.nojekyll` são arquivos de entrada do site, mantidos na raiz. O gerador continua produzindo o jogo em `dist/`; editar o HTML gerado diretamente perde a alteração na próxima geração. O uso offline de `dist/VORA.html` continua disponível.

## Verificação

`tests/pages.test.mjs` verifica o destino relativo, o link alternativo, a presença do jogo e a desativação do Jekyll. A suíte completa mantém os contratos de geração, funcionamento e saves. A verificação do Pages exige também conferir a execução remota e a resposta HTTP pública; testes locais não comprovam que um commit já foi publicado.
