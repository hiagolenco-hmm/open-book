# Open Book no iPad (versão 2.5.1)

Mesmo layout e mesmos recursos do programa de Windows. Funciona 100% offline depois da primeira abertura. Os dados ficam no próprio iPad (IndexedDB), incluindo imagens e vídeos importados.

## Instalar (uma vez só)
O iPad exige que o app venha de um endereço **https** para funcionar offline. O jeito mais simples e gratuito:
1. Crie um repositório no GitHub (ex.: `openbook`) e envie **o conteúdo desta pasta** (index.html, sw.js, web.js, etc.) para ele.
2. Em *Settings → Pages*, escolha a branch `main` / pasta `root` e salve. O GitHub mostra o endereço (https://SEU-USUARIO.github.io/openbook/).
3. No iPad, abra esse endereço no **Safari**, aguarde carregar (~1 min, ele baixa o app para uso offline), toque em **Compartilhar → Adicionar à Tela de Início**.
4. Abra pelo ícone da Tela de Início. Pode desligar a internet: tudo funciona.

(O dicionário de sinônimos/tradução, ~30 MB, é baixado na primeira vez que você o usa e depois fica guardado.)

## Diferenças do Windows
- **Toque longo** (meio segundo) = botão direito (menus de página, emoji, tabela, link…).
- O menu de mídia (vídeo/imagem) aparece ao tocar no item e some sozinho em 10 s.
- Vídeos: use o botão de arquivo do bloco de vídeo; ele fica guardado no iPad (não na pasta User data).
- Backup: o botão **Backup** baixa um .json para o app Arquivos. Faça de vez em quando (o iOS pode apagar dados de sites que ficam muito tempo sem uso; instalado na Tela de Início isso é bem mais seguro).
- O botão de câmera/OCR usa a câmera do iPad (escrita a mão continua limitada, como no Windows).
- Os dados do iPad e do Windows são separados; para levar notas de um para o outro use Backup → importar.
- Ainda não testei no Safari real do iPad (só em simulação de tela de iPad no Chromium).
