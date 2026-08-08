# Rede de Lideranças

PWA mobile-first para cadastro consentido de contatos, gestão de acessos e envio de comunicados pela WhatsApp Business Platform.

## O que está implementado

- Acesso sem senha própria: a identidade vem do login seguro da plataforma e o e-mail precisa estar na lista de usuários.
- Primeiro acesso vira administração; depois disso, somente pessoas previamente liberadas entram.
- Lideranças cadastram e visualizam apenas os próprios contatos.
- Administração visualiza a rede, libera acessos e cria disparos.
- Cadastro registra origem, liderança, data e versão do texto de consentimento.
- Números duplicados são bloqueados em toda a rede.
- Disparos usam modelos aprovados, criam uma fila persistente e podem ser retomados pelo histórico.
- Webhook registra envio, entrega, leitura e falha.
- `SAIR`, `PARAR`, `CANCELAR` e `DESCADASTRAR` interrompem novos envios e geram registro de retirada do consentimento.
- Trilhas de auditoria registram criação de contato, acesso e disparos.
- Instalação como PWA no Android e iPhone, sem lojas e sem APK.

## Papéis

| Papel | Acesso |
| --- | --- |
| Liderança | Cadastra contatos e consulta apenas os próprios registros. |
| Administração | Consulta toda a rede, libera usuários e executa ou retoma disparos. |

## Ativação do WhatsApp

O projeto usa exclusivamente a Cloud API oficial. Configure os valores abaixo como segredos do ambiente hospedado; nunca coloque tokens no código ou no Git:

```env
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=vXX.X
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_APP_SECRET=
```

No painel da Meta:

1. Vincule um número à WhatsApp Business Platform e obtenha o `phone number ID`.
2. Gere um token de sistema com permissão de mensageria.
3. Crie e aprove os modelos usados no aplicativo, como `atualizacao_semanal`, `convite_encontro` e `agenda_bairro`.
4. Se o modelo usar o primeiro nome, mantenha o nome como o primeiro parâmetro do corpo. Se não usar, desative `includeNameParameter` na criação do disparo.
5. Inclua no próprio modelo a identificação completa do remetente, o canal de privacidade e a instrução para responder `SAIR`.
6. Configure o webhook em `/api/whatsapp/webhook`, usando o mesmo token de verificação do ambiente e assinaturas com o segredo do aplicativo.

Mensagens iniciadas pela organização exigem opt-in e modelo aprovado. A versão da Graph API fica em variável de ambiente para permitir atualização sem mudança no código.

## Banco e privacidade

O banco é **Postgres no Neon** (integração nativa do Vercel Storage). As sete tabelas continuam as mesmas: usuários, contatos, consentimentos, campanhas, destinatários da fila, auditoria e configurações.

No Vercel: **Storage → Create Database → Neon**, copie `DATABASE_URL` e rode `npm run db:push` (ou aplique `drizzle/0001_neon_postgres.sql`).

O cadastro evita classificação ideológica, intenção de voto ou perfil comportamental. A base contém apenas os dados operacionais necessários. Uma retirada pelo WhatsApp é aplicada imediatamente; pedidos de eliminação podem ser processados pela administração e precisam respeitar a política de retenção definida pela campanha.

## Desenvolvimento

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL
npm run db:push
npm run dev
```

- `npm run lint`: análise estática.
- `npm run db:generate` / `npm run db:push`: schema Drizzle → Neon.
- `npm run build`: build Next.js para Vercel.

O primeiro e-mail que entrar (banco vazio) vira administração. Depois disso, só e-mails liberados no painel entram.
