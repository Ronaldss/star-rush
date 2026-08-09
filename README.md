# Star Rush

Mini game multiplayer 2D para navegador com `Node.js`, `Express`, `Socket.IO` e `Canvas`.

## Rodar localmente

```bash
npm install
npm start
```

Abra `http://localhost:3000`.

## Deploy gratuito no Render

Este projeto foi preparado para deploy como **Web Service** no Render com o arquivo `render.yaml`.

### Antes de começar

1. Crie uma conta no Render.
2. Crie uma conta no GitHub, se ainda nao tiver.
3. Envie este projeto para um repositorio no GitHub.

### Subindo no GitHub

Se quiser fazer isso pelo terminal:

```bash
git init
git add .
git commit -m "Initial Star Rush"
```

Depois crie um repositorio no GitHub e conecte com:

```bash
git remote add origin SEU_REPOSITORIO_GITHUB
git branch -M main
git push -u origin main
```

### Criando o deploy no Render

1. Entre em [https://render.com](https://render.com)
2. Clique em `New +`
3. Escolha `Web Service`
4. Conecte sua conta do GitHub
5. Selecione o repositorio `star-rush`
6. Confirme as configuracoes:

- `Runtime`: `Node`
- `Build Command`: `npm install`
- `Start Command`: `npm start`
- `Instance Type`: `Free`

7. Clique em `Create Web Service`

O Render vai gerar uma URL publica parecida com:

`https://star-rush.onrender.com`

Essa sera a URL para compartilhar com os jogadores.

## Observacoes importantes sobre o plano gratuito

- Em 9 de agosto de 2026, o Render ainda oferece deploy gratuito para `Web Service`, segundo a documentacao oficial.
- No plano gratuito, o servico pode entrar em modo de espera depois de um tempo sem uso.
- Na primeira conexao depois desse periodo, o jogo pode demorar alguns segundos para acordar.
- Para este MVP, mantenha apenas `1` instancia do servidor.

## Como os jogadores entram

1. Abra a URL publica do Render no navegador do celular.
2. Digite o apelido.
3. Toque em `JOGAR`.
4. Compartilhe a mesma URL com os outros jogadores.

Todos entram na mesma partida porque o jogo usa um unico servidor em memoria.
