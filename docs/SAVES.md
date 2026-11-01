# Saves e mudança do caminho do HTML

O progresso continua em `localStorage`, chave **vora-v1**, no navegador que você usou para jogar. Não existe save dentro do HTML nem no backup do projeto. A reorganização preserva o formato e testa a carga de saves antigos, estoque, poses, spawns e preferências.

Navegadores podem separar o armazenamento de arquivos `file://` por caminho e perfil. Por isso, abrir `C:\Vora\dist\VORA.html` pode mostrar uma partida nova mesmo que o progresso ainda exista ao abrir o HTML antigo em Downloads. Isso não significa que o save antigo foi apagado. Mantenha o original e use o mesmo navegador/perfil.

## Se o progresso aparecer vazio no novo caminho

1. Feche o novo jogo.
2. Abra o **arquivo antigo no local onde você jogava** e no mesmo perfil de navegador.
3. Confirme que seu progresso aparece. Não use “Recomeçar progresso”.
4. Exporte uma cópia do save e importe no novo caminho, conforme o procedimento abaixo. Se preferir, peça ajuda para essa transferência; nenhum save real foi acessado ou modificado durante esta entrega.

## Exportar um JSON de segurança

Este procedimento usa o console do navegador (F12 → Console). Execute no **jogo antigo com seu progresso visível**, depois de ler o código. Ele apenas lê `vora-v1` e baixa um arquivo local `VORA-save.json`:

```javascript
(() => {
  const value = localStorage.getItem('vora-v1');
  if (!value) throw new Error('Nenhum save encontrado neste arquivo/perfil.');
  JSON.parse(value);
  const url = URL.createObjectURL(new Blob([value], {type: 'application/json'}));
  const a = document.createElement('a');
  a.href = url; a.download = 'VORA-save.json'; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
})();
```

Guarde esse JSON fora de `dist`, pois essa pasta contém apenas resultados gerados. Não envie saves pessoais ao GitHub.

## Importar no novo jogo

1. Abra `C:\Vora\dist\VORA.html` no navegador/perfil desejado.
2. Se já houver progresso nesse caminho, exporte-o primeiro usando o procedimento anterior.
3. Abra F12 → Console e execute o código abaixo. Escolha o JSON de segurança que você exportou.
4. Confirme a substituição somente depois de conferir o nome do arquivo. A página será recarregada.

```javascript
(() => {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    try {
      const raw = await file.text(), save = JSON.parse(raw);
      const valid = save && Number.isInteger(save.r) && save.r >= 0 && save.r <= 20 &&
        Number.isInteger(save.d) && save.d >= 0 && save.d <= 20 &&
        Number.isFinite(save.coins) && save.coins >= 0 &&
        Number.isInteger(save.collected) && save.collected >= 0 &&
        Number.isInteger(save.sold) && save.sold >= 0 &&
        Array.isArray(save.cargo) && save.cargo.length < 400 &&
        save.cargo.every(t => Number.isInteger(t) && t >= 0 && t < 4);
      if (!valid) throw new Error('Formato de save inválido. Nada foi substituído.');
      if (!confirm('Substituir o progresso deste caminho pelo arquivo ' + file.name + '?')) return;
      // Evita que o handler de saída grave a partida atual por cima da importação.
      window.removeEventListener('pagehide', persist);
      localStorage.setItem('vora-v1', raw);
      location.reload();
    } catch (error) { alert(error.message); }
  };
  input.click();
})();
```

Não há transferência automática entre perfis, navegadores ou computadores. Se o armazenamento do navegador estiver indisponível, o jogo continua na sessão e mostra essa condição em Configurações.
