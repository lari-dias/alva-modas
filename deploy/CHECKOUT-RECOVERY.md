# Checkout — implantação, recuperação e rollback

Este roteiro exige revisão e autorização antes de qualquer publicação ou migration em produção. Build/start não executam migrations. Pedidos históricos, itens e estoque não são removidos ou reconstruídos pela release. Nunca executar os testes destrutivos da base isolada contra o Neon.

## Topologia adotada

Navegador → `https://LOJA/api/...` → função Node da Vercel → NestJS no Render → PostgreSQL no Neon.

- Root Directory da Vercel: `frontend`. A função `api/[...path].js` usa `server/api-proxy.mjs`; `vercel.json` separa API e fallback da SPA.
- `VITE_API_URL=/api` é obrigatório no build de produção. URLs diretas para o Render são rejeitadas pelo validador de produção.
- O proxy permite somente rotas/métodos conhecidos. Não encaminha rotas administrativas, Authorization do navegador, destinos arbitrários ou redirects do upstream. Não repete compras após timeout.
- O segredo `API_PROXY_SECRET` é inserido apenas pela função. O Render exige esse segredo em produção; chamadas diretas de abas antigas não podem confirmar compras. `GET /produtos` permanece público para o health check; `/internal/checkout/*` exige uma credencial administrativa independente.
- Não publicar este frontend como Render Static Site: esse serviço não executa as funções da Vercel. O `render.yaml` contém somente a API; configurar o frontend e a função no projeto Vercel.

## Cookies, CORS e CSRF

O cookie `alva_session` permanece host-only, `HttpOnly`, `Secure`, `SameSite=Strict`. Configurar `JWT_COOKIE_PATH=/api/auth` no Render, que é o caminho visto pelo navegador. O proxy remove `/api` apenas ao montar a requisição ao NestJS, sem enfraquecer os atributos do cookie. Recusa cookies com Domain, Path incompatível ou atributos ausentes. Logout usa o mesmo Path.

O navegador só acessa a origem da loja; não depende de cookies de terceiros entre `vercel.app` e `onrender.com`. Pode ser necessário entrar novamente uma vez: cookies antigos do host Render ou do Path `/auth` não são transferidos automaticamente para o novo caminho. Não apagar localStorage para migrar a sessão: ele pode conter uma tentativa que precisa ser recuperada.

Para escritas, o proxy exige Origin exata da loja, JSON e ausência de `Sec-Fetch-Site: cross-site`. O backend também verifica a origem e autentica o proxy. CORS permite somente as origens explicitamente configuradas, com credenciais; não usar `*`. Ausência de Origin em escritas públicas é recusada em produção. As rotas administrativas usam Bearer token não ambiente de navegador e não são expostas pelo proxy. Nenhuma proteção depende somente de CORS ou do nome de um header.

O limite de autenticação usa o IP da plataforma Vercel, encaminhado em header privado somente após autenticar o proxy. Carrinho, status e tentativas de checkout compartilham um limite adicional de 120 requisições por IP/minuto, com resposta 429 e Retry-After. Ambos os limites são locais ao processo; manter uma instância e complementar com limites no ingresso se necessário. A Vercel sobrescreve `X-Forwarded-For`; não implantar esta função em outro provedor sem revisar essa confiança. Verificar os IPs de dois clientes reais em homologação, sem registrar credenciais. Não ampliar irrestritamente `trust proxy`.

## Inventário manual de configuração

| Local | Configuração |
| --- | --- |
| Vercel Production | `VITE_API_URL=/api`; build `npm run build:prod`; saída `dist`; Node 24.x; funções com duração de 60 s |
| Vercel, somente servidor | `API_UPSTREAM_URL=https://HOST_REAL_RENDER` sem caminho; `STOREFRONT_ORIGIN=https://HOST_CANONICO_LOJA` sem caminho; `API_PROXY_SECRET` aleatório, mínimo 32 caracteres |
| Render | `NODE_ENV=production`, Node 24.18.0, `PORT` fornecido pela plataforma, `FRONTEND_URL` com a origem canônica exata; uma instância paga Starter; `TRUST_PROXY_HOPS` validado para a cadeia real |
| Cookie/JWT Render | `JWT_COOKIE_SECURE=true`, `JWT_COOKIE_PATH=/api/auth`; preservar `JWT_SECRET` existente |
| Operação Render | `API_PROXY_SECRET` igual ao segredo da função; `CHECKOUT_ADMIN_TOKEN` aleatório e distinto, mínimo 32 caracteres |
| Neon/Render | `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `DB_SSL=true`, eventual `DB_SSL_CA` confiável; runtime separado do migrador |
| Resend/Render | `CHECKOUT_OUTBOX_ENABLED=true`, `RESEND_API_KEY`, `RESEND_FROM` de domínio verificado; `SMTP_ENABLED=false` para este fluxo |
| Ambiente seguro do operador | `CHECKOUT_CONTROL_URL=https://HOST_REAL_RENDER`, `CHECKOUT_ADMIN_TOKEN` idêntico ao do Render |

Não colocar segredos em `VITE_*`, repositório, argumentos do CLI, screenshots, analytics ou tickets. Não compartilhar credenciais de produção com deploys Preview. Homologação precisa de origem estável, backend, banco e destinatários de teste isolados. Um preview que não corresponda a `STOREFRONT_ORIGIN` é bloqueado por projeto. Configurar redirecionamento entre apex/www para uma única origem canônica.

O plano Starter está declarado no Blueprint, mas o plano efetivo, a quota de funções Vercel, os domínios e as variáveis dos painéis precisam ser conferidos manualmente. Desabilitar deploys automáticos durante a release. Alterar `VITE_API_URL` exige novo build; apenas salvar a variável não atualiza bundles existentes.

## Idempotência e migrations

As migrations necessárias são `CheckoutPersistente1794400000000` e `ControleCheckout1794500000000`, além das anteriores já existentes. Conferir o histórico e todas as migrations pendentes antes de executar o runner: ele executa todas as pendentes, não apenas a última.

- `checkout_tentativas`: chave primária de idempotência, vínculo com carrinho/titular/pedido, hash do segredo, snapshot, estado e resultado.
- `checkout_carrinhos`: exclusão persistente entre preparação/alterações e marcador de carrinho confirmado.
- `email_outbox`: um evento por pedido, lease, retries e revisão manual.
- `checkout_controle`: controle operacional singleton. Nasce fechado, sem drenagem presumida e sem retirada definitiva do legado.

Pedido, itens, baixa de estoque, confirmação da tentativa e outbox são gravados na mesma transação. A mesma tentativa retorna o resultado persistido; chaves diferentes não confirmam o mesmo carrinho duas vezes. O snapshot permite resolver uma tentativa preparada após reinício do processo. Carrinhos ainda não preparados continuam em memória e podem se perder durante a troca de processo; não prometer preservação desses carrinhos ou downtime zero nesta primeira migração.

Aplicar migrations compiladas com papel migrador e conexão ao destino confirmado, somente após autorização. Em seguida aplicar `deploy/postgres/02-runtime-grants.sql` com `target_database` correto. Runtime precisa SELECT/INSERT/UPDATE nas três tabelas do checkout/outbox e SELECT/UPDATE em `checkout_controle`, sem DELETE/DDL. Não usar `synchronize`, seed ou `migration:revert:prod` como parte da release.

## Pausa e drenagem implementadas

O controle é persistente e compartilhado pelas versões novas, sem reiniciar o Render:

```text
node backend/scripts/checkout-control.mjs status
node backend/scripts/checkout-control.mjs readiness
node backend/scripts/checkout-control.mjs pause
node backend/scripts/checkout-control.mjs retire-legacy
node backend/scripts/checkout-control.mjs open
```

Executar da raiz do repositório, com as variáveis seguras do operador. O script nunca recebe token por argumento nem o imprime. O proxy público não encaminha essas rotas.

`pause` fecha novas admissões no banco antes de aguardar um advisory lock exclusivo. Preparações/confirmações admitidas mantêm o lock compartilhado até commit/rollback. Somente depois disso retorna `aberto=false,drenado=true`. `open` exige pausa drenada. A verificação de resultados continua permitida durante manutenção; a outbox continua processando pedidos já confirmados. A interface consulta disponibilidade antes de criar uma tentativa e informa manutenção sem alterar o visual geral.

Timeout, falha de rede ou apenas `aberto=false` não comprovam drenagem. Consultar `status` até obter também `drenado=true`; se necessário repetir `pause`. Não editar flags diretamente nem reabrir se o resultado estiver inconclusivo. `readiness` verifica schema/permissões e informa ativação/configuração da outbox sem expor valores secretos. Não substitui o envio funcional de homologação nem prova entrega de e-mail.

O endpoint antigo nunca executa o checkout sem persistência: inicialmente retorna 503 de manutenção. Só passa a 410 depois de `retire-legacy`, que exige pausa drenada. A retirada é definitiva para esse fluxo; não existe opção para reativar o endpoint inseguro. Abas antigas precisam recarregar a loja.

## Sequência exata da primeira implantação

1. Aprovar a release; preparar os artefatos sem publicar, registrar SHA/IDs e definir responsáveis pela pausa, validação e rollback. Homologar a topologia com Safari real no iPhone e desktop. Confirmar backups recuperáveis e a lista de pedidos já existentes.
2. Preparar todas as variáveis, domínios e segredos nos ambientes corretos. Validar o mesmo conjunto de artefatos com privilégios mínimos em PostgreSQL isolado. Não testar migrations no Neon de produção.
3. Com autorização separada, aplicar as migrations aditivas e os grants, antes de subir o backend novo. A versão antiga pode continuar operando enquanto apenas essas estruturas são criadas. Conferir histórico, permissões e preservação dos pedidos.
4. Ativar manutenção no ingresso do Render antigo, cobrindo também sua URL direta. Somente bloquear a interface ou o proxy Vercel não basta: abas antigas chamam o Render diretamente. Drenar requisições antigas e registrar resultados incertos para conferência. Não limpar marcadores legados.
5. Publicar o backend novo ainda sob manutenção externa. O novo controle permanece fechado por padrão. Esperar a versão antiga encerrar completamente e conferir os logs/processos/conexões em curso. Não considerar o health check da nova versão, nem um tempo fixo de espera, prova de que a antiga parou. Se não for possível comprovar isso, parar/suspender a versão antiga antes de continuar.
6. Com nenhuma instância antiga acessível, liberar a manutenção externa do Render. O gate da aplicação continua fechado; escritas diretas sem segredo de proxy são recusadas. Rodar `status`, `readiness` e `pause`. Exigir `schemaEPermissoes=true`, outbox/configuração esperadas e `aberto=false,drenado=true`.
7. Publicar/promover o frontend e a função Vercel, com `VITE_API_URL=/api`. Validar o proxy, login, recarga e cookies enquanto o checkout permanece em manutenção. A página de checkout deve preservar a sacola e não criar uma tentativa ao receber status fechado.
8. Executar `retire-legacy` e verificar que o endpoint antigo não pode confirmar compras. Registrar esse backend como baseline operacional seguro. Manter disponíveis somente artefatos compatíveis com o controle e a idempotência para futuras reversões.
9. Executar `open`, confirmar status e fazer verificação funcional controlada de compra, consulta, repetição e nova sacola. Uma compra real de verificação gera pedido e baixa estoque: usar homologação para o ensaio completo e obter aprovação específica se a verificação final de produção envolver pedido real. Nunca repetir uma compra incerta para testar.
10. Monitorar erros, pedidos, estoque, tentativas e outbox. Não liberar deploy automático até encerrar a observação e registrar o baseline validado.

A pausa implementada não controla retroativamente o backend antigo. A etapa 4 é uma ação manual obrigatória da primeira implantação. Não há garantia de checkout continuamente disponível nessa transição; o objetivo é uma janela controlada e sem duplicação de pedidos. A navegação estática pode continuar, mas a manutenção externa inicial pode afetar temporariamente chamadas da API.

## Atualizações posteriores

Com todas as versões em uso já conhecendo o gate, executar `pause` e confirmar drenagem antes da troca. Aplicar somente migrations compatíveis, publicar backend, validar readiness, publicar frontend, testar e executar `open`. Manter o mesmo controle no banco e o legado retirado. Não permitir instâncias antigas que ignorem o gate ou voltem a expor a compra sem idempotência.

## Rollback operacional sem perda de dados

1. Executar `pause` e confirmar `drenado=true`. Se a aplicação não responder, ativar manutenção externa do Render, bloquear também o acesso direto e drenar/parar instâncias antes de qualquer troca.
2. Preservar pedidos, itens, estoque, tentativas, carrinhos consumidos, controle e outbox. Não executar o `down` das migrations, apagar chaves de idempotência ou restaurar integralmente um backup anterior sobre o banco em uso: isso perderia pedidos posteriores ao backup e poderia causar baixa duplicada ao repetir tentativas.
3. Se o problema for do frontend/proxy, promover somente um artefato compatível com `/api`, cookies fortes e o protocolo persistente. Não voltar ao frontend que depende do endpoint antigo. Se ainda não existir um artefato compatível validado, manter manutenção e corrigir para frente.
4. Se o problema for do backend, usar somente o baseline seguro que mantenha schema compatível, pausa/drenagem, idempotência e bloqueio do legado. A primeira release ainda não possui um backend anterior seguro: seu rollback é fechar a admissão e corrigir para frente, sem retornar ao código antigo inseguro. Um botão genérico de rollback do Render não comprova compatibilidade.
5. Se somente o e-mail falhar, preservar eventos e, se necessário, configurar `CHECKOUT_OUTBOX_ENABLED=false` e realizar uma troca controlada do serviço. Isso pode reiniciar o processo; pausar/drenar antes. Compras confirmadas continuam confirmadas. Não fazer envio manual de eventos inconclusivos sem conferir a Resend.
6. Manter schema, `JWT_SECRET`, `API_PROXY_SECRET`, token administrativo e Path coerentes entre os artefatos. Conferir `status`, readiness, cookies, resultado das tentativas e permissões antes de reabrir.

Restaurar um backup em branch/banco separado para diagnóstico é diferente de substituir o banco ativo. Qualquer reconciliação de pedidos históricos deve ser individual, auditada e sem reenviar compra ou recompor estoque automaticamente.

## Outbox e Resend no Render

Conferir manualmente que o plano efetivo é Starter pago e o serviço permanece ativo. O processador roda no NestJS com polling de 5 s, lease de 2 min, `SKIP LOCKED` e timeout de 15 s por envio. Não é necessário Redis para esse volume inicial. A janela de shutdown configurada é 60 s; encerramentos abruptos preservam os eventos no banco. Não usar um serviço gratuito que suspende por inatividade para prometer envio pontual.

`RESEND_API_KEY` precisa pertencer à conta/domínio corretos e permitir envio. `RESEND_FROM` deve ser verificado; não depender de `onboarding@resend.dev` para clientes reais. Verificar DNS, limites/quota e destinatário de homologação. Sem Resend, a outbox preserva suporte a SMTP quando SMTP_ENABLED=true. A primeira tentativa é persistida antes do envio; caso não haja confirmação, o evento passa para REVISAO quando ficar elegível novamente, sem reenvio automático que possa duplicar a mensagem. Não há fallback automático entre provedores. Eventos em revisão apresentam emailStatus=FALHOU ao consultar a tentativa.

A chave estável é `checkout/<pedidoId>`. A Resend guarda a idempotência por 24 h; o código interrompe retentativas a partir de 23 h e marca `REVISAO`. Não alterar payload/remetente/template de eventos inconclusivos sem análise. Eventos antigos em revisão não devem ser reenviados automaticamente. A interface continua exibindo pedido confirmado quando o envio está pendente.

O ensaio funcional deve confirmar `PENDENTE → ENVIADO`, aceitação no painel Resend, uma repetição sem novo evento/e-mail e retomada após reinício. Aceitação pelo provedor não comprova entrega na caixa de entrada. Os testes automatizados usam mocks da Resend, não enviam mensagens reais.

Monitorar sem selecionar payloads pessoais:

```sql
SELECT estado, count(*), min(criado_em) FROM email_outbox GROUP BY estado;
SELECT estado, count(*), min(atualizado_em) FROM checkout_tentativas GROUP BY estado;
```

Alertar para `REVISAO`, pendências antigas e falhas de processamento. `/produtos` é um health check de processo/catálogo; sozinho não valida checkout ou envio.

## Checklist de homologação e liberação

- [ ] Nenhum segredo de produção em Preview, bundle ou logs; deploys automáticos sob controle.
- [ ] Migrations e grants conferidos no destino autorizado; pedidos existentes preservados.
- [ ] Proxy `/api` retorna JSON; `/checkout` recarrega a SPA; rotas administrativas não atravessam o proxy.
- [ ] Login/cadastro recebe cookie host-only com `Path=/api/auth; HttpOnly; Secure; SameSite=Strict`; logout o remove.
- [ ] Sessão permanece após recarga no Safari iPhone e desktop, sem depender de cookies de terceiros.
- [ ] Origens estranhas, POST sem Origin/JSON e escritas diretas no Render são recusadas; não há redirects que vazem credenciais.
- [ ] Usuários diferentes não recuperam tentativas alheias; visitantes exigem segredo; sessão ausente não vira visitante silenciosamente.
- [ ] Pausa impede nova tentativa sem apagar sacola; transação admitida termina antes de `drenado=true`; recuperação permanece disponível.
- [ ] Primeira versão antiga encerrada e sem tráfego direto antes da abertura; legado retirado somente depois da pausa drenada.
- [ ] Duplicação/concorrência/falha após commit não repetem pedido ou estoque; confirmação libera nova sacola.
- [ ] Outbox real homologada, quotas e alarmes verificados; eventos em revisão têm responsável.
- [ ] Artefatos compatíveis, credenciais e procedimento de rollback registrados; não há reversão destrutiva do banco.

## Testes locais e limites históricos

`backend/test/checkout-persistente.e2e-spec.ts` usa somente `127.0.0.1:55439/alva_checkout_test`, sem carregar `.env` do Neon. É opt-in e limpa tabelas desse banco descartável. Não alterar esses parâmetros para um destino remoto.

```powershell
docker start alva-checkout-test
cd backend
$env:CHECKOUT_ISOLATED_TESTS = 'true'
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run build
cd ../frontend
npm.cmd test
npm.cmd run lint
$env:VITE_API_URL = '/api'
npm.cmd run build:prod
```

Se o container não existir, criar PostgreSQL 17 descartável com banco `alva_checkout_test`, usuário `postgres`, senha local de fixture `alva-isolated-test` e bind `127.0.0.1:55439:5432`. Nunca usar essa senha em ambiente real. A suíte testa migrations reais, rollback/reaplicação com pedido histórico, privilégios mínimos, concorrência de estoque e drenagem. O ensaio de `down` é exclusivamente local.

Marcadores legados com somente UUID do carrinho não possuem token ou vínculo histórico confiável. A interface pede conferência pelo atendimento e não os apaga automaticamente. Os pedidos já existentes no Neon não recebem vínculos inventados por e-mail/horário/valor. Segredos de visitante perdidos também exigem atendimento. Após conferência inequívoca, qualquer liberação deve ser específica daquele navegador e não reenviar a compra.

## Arquivos principais desta preparação

Proxy e roteamento: `frontend/api/[...path].js`, `frontend/server/api-proxy.mjs`, `frontend/vercel.json`, `frontend/src/services/api.ts`, validação de build e testes em `frontend/scripts`.

Segurança e sessão: `backend/src/security/proxy-security.ts`, `app.setup.ts`, `auth/auth.controller.ts`, `auth/auth-rate-limit.guard.ts`, `config/environment.ts` e respectivos testes.

Operação: migration `1794500000000-ControleCheckout.ts`, `checkout-deployment.service.ts`, `checkout-deployment.controller.ts`, integração em `checkout-tentativas.service.ts`, módulo/controlador de checkout, `backend/scripts/checkout-control.mjs`, grants e `render.yaml`.

Frontend: pré-verificação de manutenção em `useCheckout.ts` e `checkout.ts`, sem mudança de layout. Testes cobrem proxy, cookies, CSRF, manutenção, drenagem e as garantias persistentes anteriores.

Referências: [Vercel Node Functions](https://vercel.com/docs/functions/runtimes/node-js), [headers da Vercel](https://vercel.com/docs/headers/request-headers), [deploys do Render](https://render.com/docs/deploys), [Blueprint Render](https://render.com/docs/blueprint-spec), [Resend idempotência](https://resend.com/changelog/idempotency-keys).

## Resultado da preparação local

- 106 testes unitários do backend aprovados.
- 75 testes HTTP/integração aprovados com PostgreSQL 17 isolado, incluindo pausa/drenagem, controle inicial fechado, permissões mínimas e preservação de pedidos históricos.
- 77 testes de aplicação frontend e 10 verificações Node de proxy/configuração aprovados.
- Builds do backend e de produção do frontend (`VITE_API_URL=/api`), lint do frontend e dos arquivos alterados do backend aprovados.
- Migrations executadas somente no container local descartável, parado ao final. Nenhuma alteração no Neon, push ou deploy nesta preparação.
- Os testes locais não substituem a configuração da Vercel/Render nem os ensaios reais de Safari e Resend em homologação; estes permanecem ações manuais antes da publicação.
