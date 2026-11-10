# Preparação para produção — Render

Este diretório prepara a publicação, mas não executa deploy, SQL, migrations, seed ou alterações em credenciais. Os `.env` locais permanecem intactos. Os exemplos devem ser preenchidos no ambiente externo, não copiados por cima do desenvolvimento.

## Topologia preparada

`render.yaml`, na raiz, descreve uma API Node em uma instância Render Starter e um front-end Render Static Site. Ambos têm deploy automático desativado. Starter é um plano pago; nada foi criado ou contratado. A opção evita o desligamento por inatividade dos serviços gratuitos e mantém uma única memória de carrinhos durante a operação normal. Não habilitar autoscaling, múltiplos processos Node ou múltiplas réplicas.

A API usa `backend` como raiz, Node 24.18.0, build de produção, remoção de dependências de desenvolvimento e `npm run start:prod`. O Render fornece `PORT`; o Nest escuta em `0.0.0.0`. O health check reutiliza `GET /produtos`, sem endpoint adicional. A janela de encerramento configurada é de 60 segundos.

O front-end usa `frontend` como raiz, `npm run build:prod` e publica `dist`. Esse comando valida a origem HTTPS pública da API antes do build. `npm run build` permanece disponível para validação local. Nenhum comando deste guia foi executado contra uma hospedagem.

Se o front-end for hospedado em outro provedor, usar os mesmos comandos/variáveis e configurar o equivalente ao rewrite descrito abaixo. O arquivo fornecido atende diretamente ao Render Static Site; a configuração de outro provedor permanece externa.

## Domínios, HTTPS e cookies

Definir os endereços reais antes da publicação, por exemplo:

- Loja: `https://www.seudominio.com`.
- API: `https://api.seudominio.com`.

Os domínios são exemplos, não endereços provisionados. A loja e a API precisam pertencer ao mesmo site para o cookie SameSite=Strict. Não considerar dois serviços independentes em `onrender.com`, ou um front-end em domínio de plataforma diferente, como uma topologia autenticada pronta: cookies de terceiros e limites de site podem impedir o login. A alternativa é um proxy real de mesma origem, que deve preservar caminhos e cookies; um redirecionamento não substitui esse proxy.

Adicionar os domínios aos serviços, configurar DNS e aguardar certificados HTTPS válidos no Render. Não há certificados privados no repositório. O Render termina TLS antes de encaminhar ao Node. CORS deve conter apenas as origens HTTPS exatas da loja, separadas por vírgula se realmente necessário, sem `*`, caminhos ou barra final.

`JWT_COOKIE_SECURE=true` é obrigatório em produção; o JWT permanece HttpOnly, SameSite=Strict, Path=/auth e expira em uma hora. O segredo é gerado pelo Render no Blueprint, não aparece no código e deve permanecer estável entre releases. Não colocar segredos em variáveis `VITE_*`.

`TRUST_PROXY_HOPS=1` é a configuração inicial para um ingresso controlado. O Express confia somente no número configurado de saltos. Confirmar a cadeia efetiva do Render e qualquer CDN adicional antes da liberação, impedir acesso que contorne o proxy e não habilitar confiança irrestrita em `X-Forwarded-For`. O limite de autenticação continua local à instância. Os testes HTTP conferem que cabeçalhos encaminhados são ignorados com zero saltos e que o endereço mais próximo é usado com um salto.

## Variáveis da API

Use `backend/.env.production.example` como inventário. O arquivo não é carregado automaticamente nem contém segredos utilizáveis.

| Variável | Configuração de produção |
| --- | --- |
| NODE_ENV | `production` |
| PORT | Valor fornecido pelo Render |
| FRONTEND_URL | Origem HTTPS real e exata da loja |
| TRUST_PROXY_HOPS | `1` na topologia inicial; validar cadeia de proxies |
| DB_HOST / DB_PORT / DB_DATABASE | Endpoint PostgreSQL e banco de produção |
| DB_USERNAME / DB_PASSWORD | Credenciais exclusivas do papel `alva_app` |
| DB_SSL | `true`, com verificação de certificado habilitada |
| DB_SSL_CA | Opcional: CA confiável do provedor em PEM, com quebras reais ou `\n` |
| JWT_SECRET | Segredo aleatório exclusivo, mínimo de 32 caracteres; gerado pelo Blueprint |
| JWT_COOKIE_SECURE | `true` |
| SMTP_* | Conforme um dos perfis abaixo |

Não definir DATABASE_URL com parâmetros SSL que conflitem com estes campos; o projeto usa as variáveis DB_* separadamente. Nunca usar `NODE_TLS_REJECT_UNAUTHORIZED=0` ou desativar verificação de certificado.

As conexões internas do Render Postgres usam certificados autoassinados e não suportam verify-full. Esta preparação mantém verificação de certificado/hostname, portanto a opção pronta é o endpoint externo completo com certificado confiável. Validar a cadeia/SNI do endpoint provisionado; se o provedor exigir CA adicional, preencher `DB_SSL_CA`. Restringir acesso externo aos IPs de saída do serviço e à administração autorizada. Não trocar para `rejectUnauthorized=false` para contornar falhas de conexão. Uma eventual escolha por TLS interno sem verificação exige análise de segurança separada.

## PostgreSQL: papéis e privilégios mínimos

Provisionar um banco novo e exclusivo de produção com o administrador do provedor. Confirmar permissões de criação de papéis e políticas do serviço gerenciado. Os arquivos SQL não são migrations nem são executados pelo build/start. Não executá-los no banco local ou em banco compartilhado.

1. Abrir uma conexão administrativa segura, sem senha em argumentos do shell ou histórico. Confirmar host, banco e ambiente.
2. Executar `deploy/postgres/01-roles.sql`, fornecendo a variável psql `target_database` com o nome confirmado. O script aborta se o banco conectado diferir. Ele cria `alva_migrator` e `alva_app`, sem superusuário, CREATEDB, CREATEROLE, replicação ou BYPASSRLS. As senhas são definidas interativamente por `\password`, usando SCRAM, sem senhas em SQL versionado.
3. Em um ambiente de release separado, usar as credenciais de `alva_migrator` para executar as migrations compiladas. Esse papel pode criar objetos apenas no schema autorizado. Não colocar seu segredo nas variáveis do processo da API.
4. Depois das migrations, executar `deploy/postgres/02-runtime-grants.sql` como administrador/owner autorizado, também com `target_database`. O papel da API recebe SELECT em produtos, UPDATE apenas em estoque/atualizadoEm, SELECT/INSERT em clientes, pedidos e itens, e USAGE no tipo de status. Não recebe DELETE, DDL ou acesso à tabela de controle de migrations.
5. Fornecer somente as credenciais de `alva_app` à API. Ele não deve ser membro de `alva_migrator`, owner do banco/tabelas ou herdar privilégios administrativos.

Exemplo de chamada psql, somente após conectar ao destino de produção confirmado:

```text
\set target_database 'NOME_REAL_DO_BANCO_DE_PRODUCAO'
\i deploy/postgres/01-roles.sql
```

Os scripts foram preparados/revisados, sem execução no PostgreSQL local. Eles destinam-se ao provisionamento inicial; se os papéis já existirem, interromper e revisar a situação, em vez de alterar credenciais ou proprietários automaticamente. Não conceder permissões genéricas em todas as futuras tabelas: revisar os grants por nome após novas migrations.

### Release e migrations

Em um job/ambiente de release separado, com o mesmo commit e Node 24, injetar DB_* do papel migrador, `DB_SSL=true`, `NODE_ENV=production` e FRONTEND_URL HTTPS. Depois:

```sh
npm ci --include=dev
npm run build
npm run migration:run:prod
```

Executar apenas após backup e revisão do destino. Não há migrations novas nesta etapa. Não usar o papel restrito da API para executar DDL. Não automatizar `migration:revert`, recriação de schema, seed ou migração na inicialização. `synchronize` e `migrationsRun` continuam false.

O Blueprint não contém preDeployCommand com credenciais administrativas: migrations e grants são uma etapa externa anterior à liberação da API. Registrar seu resultado no checklist. Seed em produção exige decisão explícita, pois o banco local não é exportado nem substituído por esta preparação.

## SMTP

### Provedor real autorizado

Para STARTTLS na porta 587:

```dotenv
SMTP_ENABLED=true
SMTP_HOST=HOST_DO_PROVEDOR
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=USUARIO_DO_PROVEDOR
SMTP_PASSWORD=SEGREDO_NO_GERENCIADOR
SMTP_FROM=REMETENTE_VALIDADO_NO_PROVEDOR
```

Na porta 465, usar `SMTP_SECURE=true` (TLS desde a conexão) e `SMTP_REQUIRE_TLS=false`. Validar domínio/remetente e DNS exigidos pelo provedor (SPF/DKIM/DMARC), além de limites e permissões de saída da hospedagem. Senhas SMTP entram somente no gerenciador de segredos, com USER/PASSWORD configurados juntos. A API recusa SMTP autenticado de produção sem TLS obrigatório ou TLS direto. Nenhum destinatário real deve receber mensagens sem autorização.

### Demonstração com capturador

Usar um serviço Mailpit/capturador isolado acessível pela rede privada, sem relay para destinatários externos:

```dotenv
SMTP_ENABLED=true
SMTP_HOST=HOST_PRIVADO_DO_CAPTURADOR
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_REQUIRE_TLS=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=pedidos@alvamodas.test
```

Esse perfil sem TLS/autenticação é exclusivo de captura em rede privada. Não expor a porta SMTP ou a caixa de mensagens publicamente. O operador pode conferir as mensagens por acesso privado/túnel autenticado. O capturador deve ficar ativo durante a avaliação; localhost no serviço Render não aponta para a máquina do desenvolvedor. Em serviços separados, usar o DNS privado do capturador, não 127.0.0.1.

`SMTP_ENABLED=false` desliga o envio e retorna DESABILITADO explicitamente; não atende à demonstração de envio exigida pelo desafio. Falha SMTP preserva a venda e retorna FALHOU. ACEITO_PELO_SMTP significa aceitação pelo servidor, não comprovação de entrega externa.

## Front-end e fallback

Definir no ambiente de build `VITE_API_URL=https://api.SEUDOMINIO`, sem caminhos, credenciais ou parâmetros. Essa URL é pública e incorporada ao bundle; mudar o valor exige novo build. `frontend/.env.local` não é alterado. O Blueprint usa `npm run build:prod` para bloquear localhost, HTTP e placeholders conhecidos.

O rewrite `/*` → `/index.html` preserva `/conta`, `/cadastro` e `/checkout` em acesso direto/recarga. O Render serve arquivos existentes antes de aplicar o rewrite, preservando assets. Não redirecionar essas rotas para `/`, pois isso altera a URL e perde a navegação do React. Validar no serviço provisionado as três rotas e um asset real.

## Carrinhos e janela de publicação

A persistência atual foi mantida: Map local, TTL de 30 minutos, UUID e bloqueio por carrinho. Uma instância sem suspensão por inatividade atende essa arquitetura durante operação estável. Não habilitar autoscaling/cluster. Ao adicionar este Blueprint a serviço existente, conferir e desativar qualquer autoscaling previamente configurado: numInstances não substitui uma configuração de autoscaling já ativa.

Reinício, falha de processo e deploy perdem carrinhos; a API retorna CART_NOT_FOUND e o React orienta recomeçar, sem recuperar itens silenciosamente. Pedidos já confirmados continuam no PostgreSQL. Essa limitação não é resolvida por um disco anexado ao serviço, porque o Map não escreve nele.

O Render pode sobrepor processos durante um rolling deploy, mesmo com uma réplica nominal. Para esta entrega, usar uma janela controlada: ativar manutenção no serviço pelo painel, aguardar requisições em curso terminarem, executar a release aprovada, conferir o health check e só então reabrir tráfego. Durante manutenção, não confirmar pedidos. Informar que sacolas anteriores serão descartadas; não prometer continuidade de carrinhos. Não automatizar reenvio de checkout com resposta incerta.

O arquivo render.yaml sozinho não garante continuidade de sessão de carrinho durante releases. Para exigir alta disponibilidade, preservação de sacolas ou múltiplas instâncias, será necessária outra etapa autorizada com persistência/bloqueios compartilhados e idempotência durável. Não houve mudança de regras de negócio nesta preparação.

## Checklist externo antes de autorizar deploy

- Resolver/aceitar explicitamente o risco residual descrito em [DEPENDENCIAS.md](DEPENDENCIAS.md).
- Escolher domínio(s), plano, região, DNS e certificados; revisar o custo do plano antes de criar recursos.
- Provisionar PostgreSQL, validar TLS e allowlist, criar papéis, realizar backup e executar migrations/grants no ambiente correto.
- Preencher secrets e origens no Render; validar o número de proxies e manter somente uma instância/processo.
- Disponibilizar SMTP autorizado ou capturador privado e conferir a mensagem de teste isolada.
- Revisar o Blueprint sem aplicá-lo automaticamente; criar um Blueprint no Render pode iniciar sua primeira publicação mesmo com autoDeployTrigger=off.
- Após autorização de publicação, testar rotas diretas, login/cookie, catálogo e compra isolada; não usar os dados locais como alvo.

Referências: [Render Blueprint](https://render.com/docs/blueprint-spec), [domínios/HTTPS](https://render.com/docs/custom-domains), [rewrites](https://render.com/docs/redirects-rewrites), [TLS PostgreSQL](https://render.com/docs/postgresql-creating-connecting), [Express atrás de proxies](https://expressjs.com/en/guide/behind-proxies/), [privilégios PostgreSQL](https://www.postgresql.org/docs/16/ddl-priv.html), [SMTP Nodemailer](https://nodemailer.com/smtp).
