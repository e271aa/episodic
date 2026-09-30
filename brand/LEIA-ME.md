# Flicki — marca (direção 1a, «Barra premida»)

## Ficheiros
- simbolo.svg — ícone a cores, quadrado, sem cantos (o iOS recorta)
- simbolo-mono-preto.svg / simbolo-mono-branco.svg — uma só cor
- wordmark-noite.svg (#f2f2f7, para fundo #000000) / wordmark-dia.svg (#000000, para fundo #f2f2f7)
- conjunto-noite.svg / conjunto-dia.svg — símbolo (cantos 22,4%) + palavra
- conjunto-mono-preto.svg / conjunto-mono-branco.svg
- icone-1024.png, icone-512.png, icone-192.png, icone-180.png — quadrados, sem cantos

## Uso na PWA
- apple-touch-icon: icone-180.png
- manifest icons: icone-192.png, icone-512.png (purpose "any"), icone-1024.png para a App Store/origem
- Título do separador / entrada: wordmark-noite.svg ou wordmark-dia.svg conforme o modo

## Cores
Mira (fixa, não muda com o modo): #e5e5ea · #ffd60a · #64d2ff · #30d158 · #da5ce8 · #ff453a · #0a84ff
Acerto: #0a84ff · #0b0b0d · #da5ce8 · #0b0b0d · #64d2ff · #0b0b0d · #e5e5ea
Barra premida: a 4.ª (verde) desce 10% da altura; o espaço por cima é #0b0b0d.
Palavra: #f2f2f7 à noite, #000000 de dia. Uma só cor: #000000 ou #ffffff.

## Espaço e tamanhos
Unidade x = altura-x do «flicki» (50/72 da altura da palavra).
Margem livre mínima à volta do conjunto e da palavra: ½x.
Entre símbolo e palavra: 22/72 da altura (fixo).
Mínimos: símbolo 16px · palavra 14px de altura · conjunto 20px de altura.
