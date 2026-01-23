# Bot Atles (Minecraft + Gemini)

Assistente de chat para servidor Minecraft feito com [mineflayer](https://github.com/PrismarineJS/mineflayer), usando Bun e Gemini (Google GenAI) para respostas.

## Requisitos
- [Bun](https://bun.sh) instalado
- Node 18+ (apenas para libs nativas, se precisar)
- Um servidor Minecraft acessível (Java Edition)
- Chave da API Gemini

## Configuração
1) Instale dependências:
```sh
bun install
```
2) Copie o exemplo de ambiente e preencha:
```sh
cp .env.example .env
```
Edite `.env` com:
- `GEMINI_API_KEY`: sua chave da AI
- `BOT_USERNAME`: nome da conta do bot
- `BOT_PASSWORD`: senha (se o servidor exigir)
- `BOT_HOST`: host do servidor Minecraft (default `127.0.0.1`)
- `BOT_PORT`: porta do servidor (default `25568`)

## Executando
Inicie o bot:
```sh
bun run bot.ts
```
O bot conecta no servidor definido pelo `BOT_HOST`/`BOT_PORT` e responde no chat.

## Notas rápidas
- O histórico de conversa é limitado aos últimos 10 turnos por jogador.
- Se `BOT_USERNAME` não estiver definido, a execução é interrompida com erro para evitar login inválido.
- Ajuste permissões/whitelist do servidor para permitir o login do bot.

## Estrutura principal
- `bot.ts`: código do bot (mineflayer + Gemini)
- `.env.example`: exemplo de variáveis de ambiente
- `saves.json`: dados adicionais do projeto (se usado)

## Troubleshooting
- **Erro de autenticação**: confirme `BOT_USERNAME`/`BOT_PASSWORD` e se o servidor permite contas não-premium conforme configurado.
- **Não conecta**: valide `BOT_HOST`/`BOT_PORT` e se a porta está aberta.
- **Sem respostas da IA**: revise `GEMINI_API_KEY` e conectividade externa.
