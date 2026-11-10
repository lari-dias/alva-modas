# Alva Modas - Backend

Base NestJS com PostgreSQL, TypeORM, validacao global e Swagger. Produtos e pedidos possuem entidades. GET /produtos lista o catalogo ativo, ordenado por nome.

## Desenvolvimento

Requisitos: Node.js 24.x (minimo 24.15.0; versao validada: 24.18.0, definida no .nvmrc da raiz) e PostgreSQL 13+ (UUID com gen_random_uuid(), sem instalar extensoes). Na pasta backend:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Ajuste as credenciais no .env e crie o banco indicado em DB_DATABASE no PostgreSQL.

Configure também `JWT_SECRET` antes de iniciar a API, conforme a seção de autenticação abaixo. Execute as migrations pendentes com `npm.cmd run migration:run`.

```powershell
npm.cmd run start:dev
```

Swagger: http://localhost:3000/api/docs

## Preparação de produção

O [guia de produção para Render](../deploy/README.md) reúne configuração HTTPS, domínios, CORS, cookies, PostgreSQL com privilégios mínimos, SMTP, migrations e a operação do carrinho em uma instância. `../render.yaml` é uma configuração revisável, sem aplicação automática nesta etapa. Não crie um Blueprint no painel antes de autorizar a primeira publicação.

Use `.env.production.example` como inventário e injete seus valores no gerenciador de segredos da hospedagem; não sobrescreva o `.env` local. Em produção, a validação exige origens FRONTEND_URL em HTTPS e `DB_SSL=true`. A conexão verifica o certificado PostgreSQL; `DB_SSL_CA` aceita a CA do provedor quando necessária. `TRUST_PROXY_HOPS` deve corresponder à cadeia real de proxies (padrão local 0, perfil inicial Render 1). Para SMTP autenticado, habilite TLS direto ou `SMTP_REQUIRE_TLS=true` com STARTTLS. As [pendências de dependências](../deploy/DEPENDENCIAS.md) continuam documentadas, sem atualização major forçada.

## Autenticação de clientes

O banco continua sendo PostgreSQL. A migration `CriarClientes1794350000000` cria apenas `clientes`, com UUID, nome, e-mail único normalizado, hash da senha e data de cadastro. Não altera produtos, pedidos, itens ou estoque. `synchronize` e `migrationsRun` continuam desativados; execute `npm.cmd run migration:show` e `npm.cmd run migration:run` na pasta `backend` para novas instalações. Não reverta a migration em um banco que contenha clientes a preservar.

No `.env`, configure:

```dotenv
JWT_SECRET=
JWT_COOKIE_SECURE=false
```

Gere um segredo exclusivo com `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"` e copie o resultado para `JWT_SECRET`. Não versione o segredo nem o coloque em variáveis `VITE_*`. A API recusa segredos com menos de 32 caracteres. Em produção use HTTPS, `NODE_ENV=production` e `JWT_COOKIE_SECURE=true`. O segredo deve ser o mesmo entre instâncias da API. Trocar o segredo invalida as sessões existentes.

| Endpoint | Dados | Resultado |
| --- | --- | --- |
| `POST /auth/cadastro` | `nome`, `email`, `senha`, `confirmacaoSenha` | 201, cliente público e cookie de sessão |
| `POST /auth/login` | `email`, `senha` | 200, cliente público e cookie de sessão |
| `GET /auth/me` | Cookie de sessão | 200 com `id`, `nome`, `email`; 401 sem sessão válida |
| `POST /auth/logout` | Sem dados obrigatórios | 204, remove cookie deste navegador |

Nome aceita 2–120 caracteres; e-mail até 254; senha e confirmação 8–128. E-mails são normalizados com trim/minúsculas; a restrição única também protege cadastros concorrentes. As senhas usam Argon2id (19 MiB, duas iterações, paralelismo 1), com salt individual. O hash não é selecionado por padrão e nunca é retornado. Login com senha errada ou cliente inexistente usa a mesma mensagem e verifica um hash também no caso de cliente inexistente.

O JWT HS256 tem issuer/audience verificados e expira após uma hora. É transportado exclusivamente no cookie `alva_session`, HttpOnly, SameSite=Strict e Path=/auth; não é exposto no JSON. Respostas autenticadas usam `Cache-Control: no-store`. CORS autoriza credenciais somente nas origens de `FRONTEND_URL`; operações de autenticação rejeitam Origin externo, permitindo as origens configuradas e navegação de mesma origem (Swagger). Use `localhost` tanto no front-end quanto na API durante o desenvolvimento; misturar com `127.0.0.1` quebra a política SameSite. Para servir em produção, mantenha front-end e API no mesmo site HTTPS ou use proxy de mesma origem.

Cadastro/login compartilham um limite de 20 tentativas por IP/minuto em memória, com quantidade de IPs limitada. Esse controle é local à instância e reinicia com a API. Em múltiplas instâncias, aplique também limitação compartilhada no proxy e configure a cadeia de proxies confiáveis antes de confiar em IPs encaminhados. Logout remove o cookie, mas não revoga uma cópia de JWT roubada antes de sua expiração; não existe lista de revogação nesta etapa.

Carrinho e checkout continuam públicos, sem vínculo obrigatório a uma conta. Não foram adicionados histórico de pedidos, recuperação de senha, favoritos ou administração. Testes de autenticação HTTP usam repositório simulado, JWT e Argon2 reais, sem criar clientes ou compras no PostgreSQL.

O carrinho retorna `code: CART_NOT_FOUND` quando o identificador nao existe ou expirou. `PRODUCT_NOT_FOUND` e `CART_ITEM_NOT_FOUND` indicam problemas do produto e nao invalidam o carrinho. Reducoes e remocoes continuam permitidas quando outros itens estao indisponiveis. Esses itens retornam `disponivel: false`; para produtos excluidos, os dados exibidos sao os ultimos conhecidos em memoria. Isso nao autoriza a compra: adicoes, aumentos e checkout revalidam os dados atuais do banco.
FRONTEND_URL aceita origens HTTP separadas por virgula, sem barra final. Padrao: http://localhost:5173.

## Migrations

A migration inicial cria produtos, pedidos, itens_pedido, enum de status, indices, chaves estrangeiras e checks. synchronize e migrationsRun estao desabilitados.
Execute na pasta backend com .env configurado:

```powershell
npm.cmd run migration:generate -- src/database/migrations/NomeDaMigration
npm.cmd run migration:create -- src/database/migrations/NomeDaMigration
npm.cmd run migration:run
npm.cmd run migration:revert
```

Geracao e execucao exigem PostgreSQL. Criacao de migration vazia dispensa conexao.
O comando migration:revert desfaz a ultima migration; reverter a inicial remove as tres tabelas e seus dados. Nao execute em um banco com dados que deseja preservar.

## Modelagem

Valores monetarios usam numeric(10,2) no PostgreSQL e string nas entidades, preservando a precisao do driver pg. Para calculos futuros, converta a representacao decimal para centavos inteiros (por exemplo, "19.90" para 1990), sem parseFloat ou multiplicacao de valores fracionarios em JavaScript.

Itens preservam nomeProduto e precoUnitario da compra. As relacoes sao obrigatorias e restringem exclusao de pedidos e produtos vinculados, preservando o historico. Produto pode ser desativado pelo campo ativo. Subtotal deve corresponder a quantidade multiplicada pelo precoUnitario; esse check usa aritmetica numeric do PostgreSQL. A finalizacao ja registra pedido, itens e desconto de estoque na mesma transacao, com bloqueio pessimista dos produtos. Os valores sao calculados em centavos e convertidos para numeric(10,2), garantindo a consistencia entre valorTotal e os subtotais gravados.

criadoEm recebe now() na insercao. atualizadoEm de Produto e atualizado pelo TypeORM nas operacoes que suportam UpdateDateColumn; nao ha trigger para atualizacoes SQL externas.

## Validacao e producao

```powershell
npm.cmd run build
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
npm.cmd run migration:run:prod
npm.cmd run start:prod
```

Testes de configuracao e HTTP dispensam banco. A aplicacao exige PostgreSQL ao iniciar. Em producao, forneca as variaveis de ambiente e execute migrations antes de iniciar.

## Catálogo e seed de produtos

`GET /produtos` retorna `id`, `nome`, `descricao`, `preco`, `imagemUrl`, `categoria` e `estoque`, somente de produtos ativos e em ordem crescente de nome. Produtos ativos com estoque zero também aparecem. `preco` é uma string decimal em reais (exemplo: `"189.90"`); `descricao` pode ser `null`. Sem produtos ativos, a resposta é `[]` com HTTP 200.

Com o `.env` configurado e a migration inicial aplicada, execute separadamente, na pasta `backend`, quando desejar cadastrar os dados fictícios:

```powershell
npm.cmd run seed:produtos
```

O seed cadastra 12 produtos: três vestidos, três blusas, três calças e três conjuntos. Usa uma transação, UUIDs fixos e `ON CONFLICT DO NOTHING`. Reexecutar não duplica registros nem atualiza preço, estoque ou status de produtos existentes. Não é executado na inicialização da API e não aplica migrations.

Para testar no Swagger: inicie com `npm.cmd run start:dev`, abra `http://localhost:3000/api/docs`, expanda **Produtos → GET /produtos**, clique em **Try it out** e **Execute**. Após o seed em um banco sem outros produtos, a resposta terá 12 produtos ordenados por nome.

As imagens são ilustrativas, hospedadas no Pexels. As 12 URLs diretas retornaram HTTP 200 e `image/jpeg` na verificação desta etapa; a disponibilidade futura depende do provedor. Referências das fotos:

| Produto | Fonte |
| --- | --- |
| Vestido Floral Aurora | [Tuấn Kiệt Jr.](https://www.pexels.com/photo/a-woman-in-a-floral-dress-12458678/) |
| Vestido Vermelho Rubi | [stardust multimedia](https://www.pexels.com/photo/woman-wearing-red-dress-11844256/) |
| Vestido Preto Essencial | [Serge Vin](https://www.pexels.com/photo/photo-of-woman-wearing-black-dress-4055517/) |
| Blusa Preta Elegance | [Daniil Kondrashin](https://www.pexels.com/photo/woman-in-a-black-blouse-and-white-pants-16295508/) |
| Blusa Branca Serena | [Thuanny Gantuss](https://www.pexels.com/photo/model-posing-in-blouse-and-pants-8764769/) |
| Blusa Floral Jardim | [Foto no Pexels](https://www.pexels.com/photo/woman-in-a-floral-blouse-and-jeans-12821015/) |
| Calça Jeans Urbana | [Dmitry Ovsyannikov](https://www.pexels.com/photo/woman-in-blouse-and-jeans-25956224/) |
| Calça Bege Cidade | [Foto no Pexels](https://www.pexels.com/photo/woman-in-a-white-blouse-and-pants-posing-in-the-city-16373388/) |
| Calça Jeans Horizonte | [Foto no Pexels](https://www.pexels.com/photo/a-woman-in-bluee-button-up-long-sleeve-shirt-and-blue-denim-jeans-4831686/) |
| Conjunto Laranja Solar | [Foto no Pexels](https://www.pexels.com/photo/woman-in-a-two-piece-set-standing-with-her-hands-in-pockets-15661634/) |
| Conjunto Bege Executivo | [Vlada Karpovich](https://www.pexels.com/photo/a-woman-in-a-beige-suit-8368058/) |
| Conjunto Rosa Presença | [Daniil Kondrashin](https://www.pexels.com/photo/young-woman-standing-in-pink-suit-14016789/) |

## Carrinho em memória

Os carrinhos são armazenados em um `Map` por processo, sem persistência. Reiniciar a API perde os carrinhos; múltiplas instâncias não compartilham esse estado. O carrinho não reserva nem altera estoque.

Limites definidos em `src/carrinho/carrinho.constants.ts`: 20 produtos distintos, 100 unidades por produto e 100 unidades totais por carrinho, 1.000 carrinhos simultâneos. Expiração após 30 minutos sem operação bem-sucedida, com limpeza a cada minuto e antes das operações. Atingir a capacidade retorna 503 até haver espaço. Operações simultâneas no mesmo carrinho retornam 409; o cliente pode tentar novamente após concluir a operação anterior.

Todos os itens são consultados novamente no banco a cada operação. Preços e estoque podem mudar; um produto inexistente retorna 404, inativo ou com estoque insuficiente retorna 409. A operação com erro preserva o carrinho anterior. Para remover um item indisponível, envie quantidade zero; os demais itens continuam sujeitos à validação. Um UUID desconhecido ou expirado retorna 404 e não cria um novo carrinho. Para começar outro, omita o header na primeira adição.

### Testar no Swagger

1. Inicie a API com `npm.cmd run start:dev` e abra `http://localhost:3000/api/docs`.
2. Consulte `GET /produtos` e copie o UUID de um produto ativo com estoque.
3. Em **Carrinho → POST /carrinho → Try it out**, deixe `X-Cart-Id` vazio e envie:

```json
{
  "produtoId": "UUID_DO_PRODUTO",
  "quantidade": 2
}
```

4. A resposta HTTP 201 contém `idCarrinho`, `itens` e `totalCentavos`. Copie `idCarrinho` para o campo `X-Cart-Id` dos próximos pedidos. O UUID é gerado pelo servidor e retornado no JSON.
5. Em `GET /carrinho`, informe o header e clique **Execute** para consultar. O header é obrigatório no GET e PUT.
6. Em `POST /carrinho`, enviar o mesmo produto com o header incrementa a quantidade, sem duplicar o item.
7. Em `PUT /carrinho`, envie o header e o mesmo formato de body com a nova quantidade absoluta. Enviar `"quantidade": 0` remove o item. Remover o último deixa um carrinho vazio com total zero.

Quantidades devem ser números inteiros JSON. Negativos, fracionários, strings numéricas, UUIDs inválidos, campos extras (incluindo preços enviados pelo cliente) e limites excedidos retornam 400. POST exige quantidade mínima 1; PUT permite zero. Estoque insuficiente retorna 409. Totais, subtotais e preços unitários são inteiros em centavos: `19980` representa R$ 199,80. O campo `produto.preco` mantém a string decimal do catálogo.

Os testes HTTP usam repositórios simulados e não gravam no PostgreSQL.

## Finalização da compra

`POST /finalizar-compra` exige `X-Cart-Id` com o UUID retornado pelo carrinho e aceita somente nome e e-mail:

```json
{
  "nome": "Maria Silva",
  "email": "cliente@example.test"
}
```

O nome é aparado e deve ter entre 2 e 120 caracteres; o e-mail é validado e limitado a 254 caracteres. Preços, totais ou campos adicionais no body são rejeitados. O endpoint rejeita carrinhos vazios (400), inexistentes, expirados ou já consumidos (404), e produtos inativos ou sem estoque (409).

A transação TypeORM consulta os produtos novamente, bloqueia suas linhas com `pessimistic_write` (`FOR UPDATE`) em ordem de UUID e valida preço e disponibilidade. Pedido, itens com nome/preço históricos e desconto de estoque são gravados na mesma transação. Valores são calculados em centavos inteiros e convertidos para strings com duas casas decimais ao persistir. Valores que ultrapassam `numeric(10,2)` são rejeitados com 422. Não há cobrança real.

Após o commit, o carrinho é removido e o e-mail é tentado. A resposta HTTP 201 contém `idPedido`, `status`, `itens`, `totalCentavos` e `emailStatus`. Os itens incluem produtoId, nomeProduto, quantidade, precoUnitarioCentavos e subtotalCentavos.

O campo `emailStatus` pode ser:

- `ACEITO_PELO_SMTP`: o servidor SMTP aceitou a mensagem; não garante entrega na caixa do cliente.
- `FALHOU`: não houve confirmação de envio. O pedido e o desconto de estoque permanecem confirmados.
- `DESABILITADO`: SMTP não habilitado; nenhuma mensagem foi enviada.

Para testar pelo Swagger, crie um carrinho, copie seu UUID e abra **Finalização da compra → POST /finalizar-compra → Try it out**. Informe `X-Cart-Id` e o JSON acima. **Execute grava uma venda e desconta estoque**: use apenas um banco de testes e execute quando desejar realizar essa operação. Repetir após sucesso retorna 404, pois o carrinho foi consumido.

### Concorrência e limites de idempotência

O bloqueio em memória do carrinho abrange toda a transação e impede também alterações de quantidade durante a finalização. Uma segunda operação simultânea no mesmo UUID recebe 409. Em caso de rollback, o carrinho é mantido e desbloqueado. A exclusão só acontece após o retorno bem-sucedido da transação. Os bloqueios de linha do PostgreSQL protegem o estoque entre carrinhos diferentes e processos que usam essa estratégia.

Essa proteção contra pedidos duplicados depende do estado em memória do processo; não há chave de idempotência persistente nem recuperação da resposta anterior. Reinicializações perdem carrinhos. Uma falha de conexão durante COMMIT pode deixar o resultado incerto: o banco pode ter confirmado mesmo que a aplicação tenha recebido erro. Não recrie/reenvie a compra automaticamente sem conferir o banco. Múltiplas instâncias não compartilham carrinhos. O envio de e-mail não possui outbox, persistência do status ou repetição automática: uma interrupção após commit pode impedir o envio, preservando a venda. Essas limitações exigiriam evolução específica da persistência, fora desta etapa.

### SMTP de desenvolvimento com Mailpit

O SMTP vem **desabilitado por padrão**. O `.env` existente não é alterado automaticamente. Para habilitar um capturador local de mensagens, com Docker disponível, inicie o [Mailpit](https://mailpit.axllent.org/docs/install/docker/):

```powershell
docker run -d --name alva-mailpit -p 127.0.0.1:1025:1025 -p 127.0.0.1:8025:8025 axllent/mailpit
```

Adicione ao seu `.env`, mantendo as credenciais do PostgreSQL:

```dotenv
SMTP_ENABLED=true
SMTP_HOST=127.0.0.1
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=pedidos@alvamodas.test
```

Reinicie a API e veja as mensagens em `http://localhost:8025`. Essa configuração apenas captura mensagens no Mailpit local; não configure relay/encaminhamento para destinatários externos. `SMTP_SECURE=true` seleciona TLS desde o início da conexão, normalmente usado na porta 465; mantenha false no Mailpit local. Se usar um SMTP de sandbox autenticado, informe SMTP_HOST/PORT/SECURE conforme o provedor e configure SMTP_USER e SMTP_PASSWORD juntos, apenas no ambiente. Nenhum erro de SMTP é devolvido ou registrado com credenciais.

### Testes desta etapa

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test -- --runInBand
npm.cmd run test:e2e -- --runInBand
```

Os testes de finalização usam um banco transacional simulado para verificar rollback, concorrência, consumo do carrinho, preços atuais e falha de e-mail. Não conectam ao PostgreSQL nem comprovam locks em uma instância real. Os testes de e-mail usam Nodemailer com um servidor SMTP capturador em 127.0.0.1 e porta efêmera, sem DNS reverso e sem entrega externa. Incluem rejeição SMTP e escape de HTML. Nenhuma compra é criada no banco configurado pelo `.env` durante essas suítes.
