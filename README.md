# Nexo Mensagens

MVP local para importar conversas, classificar mensagens, detectar urgências e prazos, e acompanhar insights em um dashboard.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS
- ESLint

## Fluxo atual

Importação -> normalização -> análise por regras ou Ollama -> dashboard

## Estrutura principal

- `src/app` — páginas e layout da aplicação
- `src/components` — componentes visuais do dashboard
- `src/lib` — modelos, dados mockados e lógica de análise

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000

## Dados mockados

A aplicação usa mensagens fictícias para simular um grupo de conversa com prazos, eventos e solicitações urgentes.

## Importar conversas do WhatsApp

No dashboard, selecione um arquivo `.txt` exportado pelo WhatsApp. As mensagens importadas e a análise por regras são processadas no próprio navegador e salvas no armazenamento local deste navegador; elas não são enviadas às APIs do projeto. Os grupos fictícios continuam disponíveis.

Para exportar no WhatsApp, abra os detalhes do grupo, escolha **Exportar conversa** e selecione **Sem mídia**. O MVP reconhece linhas exportadas com data, horário, remetente e mensagem; mensagens com várias linhas são mantidas. Arquivos com mídia não são necessários para esta demonstração. Apagar os dados do site/navegador também remove as conversas importadas.

## Coleta automática pelo WhatsApp Web (experimental)

O leitor Playwright abre o WhatsApp Web em uma janela própria; na primeira execução, escaneie o QR Code. A sessão do navegador, a lista de grupos, um token local de acesso e as mensagens coletadas ficam em `.local/`, que é ignorada pelo Git. A rota autenticada do Next.js grava as mensagens em `.local/whatsapp-messages.json`, sem enviá-las a um serviço de armazenamento externo.

1. Instale as dependências com `npm install` e o navegador com `npx playwright install chromium`.
2. Inicie o dashboard com `npm run dev`.
3. Em outro terminal, execute `npm run whatsapp:read`. Na primeira execução, o leitor cria `.local/whatsapp-groups.json` e encerra.
4. Edite esse arquivo e coloque os nomes exatos dos grupos, por exemplo `{"groups":["Nome do grupo"],"pollIntervalSeconds":60}`.
5. Execute `npm run whatsapp:read` novamente e escaneie o QR Code, se for solicitado.

O leitor só acessa os grupos listados, não envia mensagens e repete a leitura no intervalo configurado (mínimo de 30 segundos). Mensagens duplicadas são descartadas. Como o WhatsApp Web não oferece essa interface como API oficial para grupos pessoais existentes, os seletores podem deixar de funcionar após atualizações; a coleta é experimental e só consegue ler mensagens que o WhatsApp Web carregar na tela. Mantenha o computador ligado e o dashboard ativo. Para parar, use `Ctrl+C` no terminal do leitor. Excluir `.local/whatsapp-session/` encerra a sessão salva; excluir `.local/whatsapp-messages.json` apaga o histórico coletado.

## Análise e IA local

Por padrão, as análises usam regras locais e não iniciam um modelo de IA. Para habilitar o modelo local, instale o [Ollama](https://ollama.com/download), copie `.env.example` para `.env.local` e defina `AI_PROVIDER="ollama"`. O modelo escolhido é Qwen3 8B:

```bash
ollama serve
# Em outro terminal:
ollama pull qwen3:8b
npm run dev
```

Configure `OLLAMA_BASE_URL` e `OLLAMA_MODEL` em `.env.local` se necessário. A inferência acontece no servidor; quando o Ollama está indisponível ou retorna uma resposta inválida, o backend usa as regras locais como fallback. O Qwen3 8B exige memória significativa; em máquinas com pouca RAM, mantenha `AI_PROVIDER="heuristic"`.

## Backend

- `GET /api/groups` — lista os grupos disponíveis
- `GET /api/groups/:groupId` — retorna mensagens, análises e insights do grupo
- `/api/whatsapp` — recebe mensagens do leitor experimental do WhatsApp Web
- `src/lib/server/group-repository.ts` — acesso atual aos dados mockados
- `src/lib/server/group-service.ts` — coordena análise e montagem do dashboard
- `src/lib/server/ollama-client.ts` — integração e validação da resposta do Ollama

As análises das rotas de grupo são processadas no servidor. Os grupos ainda vêm de dados mockados; conversas importadas pelo dashboard ficam no armazenamento local do navegador, e o leitor experimental grava mensagens em `.local/whatsapp-messages.json`. Ainda não há persistência PostgreSQL nem endpoint REST genérico para receber mensagens.

## Próximos passos

- persistir grupos, mensagens e análises com PostgreSQL e Prisma
- criar um endpoint `POST` validado para ingestão de mensagens
- cobrir o fluxo de análise e fallback com testes automatizados sem exigir Ollama
