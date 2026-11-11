# Correções da auditoria — 11/11/2026

## Resultado e escopo

Branch: correcao-auditoria-entrega, criada de diagnostico-carrinho em ea924c5. main, origin/main e diagnostico-carrinho permaneceram no mesmo commit; homologacao permaneceu em c458156. Nenhum commit, merge, push ou deploy foi feito.

O conjunto persistente foi reaproveitado seletivamente do commit c458156 de homologacao: 52 arquivos, com integração pontual no hook local. Não houve merge de branches. README principal, favicon e instrumentação local foram preservados; a documentação foi posteriormente atualizada para o protocolo atual. Os arquivos locais preexistentes não foram removidos. Um backup do patch original e dos arquivos de diagnóstico permanece em .tmp/antes-correcao-auditoria (ignorado pelo Git).

## Problemas corrigidos

- Reduções usam a quantidade atual do servidor dentro do Web Lock, inclusive com caches independentes. Erro de consulta não produz PUT a partir de cache antigo. Fila local, locks e instrumentação existentes foram preservados.
- GET da sacola retorna itens indisponíveis com disponivel=false e dados anteriores de produtos excluídos. Isso permite correção após recarga sem cache. Adições, aumentos e checkout continuam revalidando disponibilidade.
- Tentativas persistentes, autorização por titular/segredo e recuperação da confirmação; resultado, pedido, itens, estoque e outbox são confirmados atomicamente. Repetição após resposta perdida não duplica pedido nem estoque.
- Botão de verificação e mensagem visível após encerramento sem pedido; erros incertos anteriores são limpos somente após resultado terminal comprovado.
- Outbox com lease e chave estável Resend. SMTP preservado: primeira tentativa registrada antes do envio e resultado incerto enviado para revisão, sem repetição automática. Revisão atualiza emailStatus=FALHOU sem desfazer o pedido.
- Proxy Vercel de mesma origem, cookies fortes com Path correto, validação de origem e credencial de proxy. Blueprint passa a conter somente a API, evitando frontend estático incompatível com a função.
- Limite adicional de 120 requisições/IP/minuto para carrinho, status e tentativas; limite de autenticação separado preservado.
- Três erros TypeScript originais e 11 erros de lint corrigidos. Corrigida também tipagem da suíte PostgreSQL reaproveitada. Scripts typecheck incluem testes; lint backend não aplica correções implicitamente (lint:fix permanece disponível).
- Exemplos de ambiente e documentação atualizados, sem editar .env reais, chaves ou credenciais existentes.

## Validação executada

| Verificação | Resultado |
| --- | --- |
| Frontend: npm test | 98 testes Vitest e 10 verificações Node aprovados |
| Backend: npm test -- --runInBand --silent | 109 testes aprovados, 13 suítes |
| Backend: CHECKOUT_ISOLATED_TESTS=true e test:e2e | 79 testes aprovados, 7 suítes |
| ESLint frontend/backend | Aprovados, sem correção automática |
| TypeScript completo frontend/backend | Aprovados, incluindo testes |
| Build backend | Aprovado |
| Build frontend de produção, VITE_API_URL=/api | Aprovado |
| Scripts de controle/proxy: node --check | Aprovados |
| git diff --check | Aprovado |

Os testes reais usam somente o container alva-checkout-test, PostgreSQL 17 Alpine, bind 127.0.0.1:55439 e banco alva_checkout_test. Foram executadas migrations, limpeza de fixtures, rollback/reaplicação e grants apenas nesse banco descartável. Incluem concorrência entre conexões, último estoque, falha após COMMIT real, persistência de outbox, permissões mínimas e pausa/drenagem. Resend foi simulada; testes SMTP usam capturador loopback. Nenhuma compra, migration, seed ou alteração ocorreu no banco externo/produção.

O container de testes foi parado ao final, sem remoção do volume ou alteração dos demais containers.

## Dependências e limites restantes

- npm audit completo: frontend 10 pacotes moderados; backend 24 moderados e 5 baixos. Produção mantém a cadeia TypeORM/glob/minimatch já registrada; lockfiles e versões não foram alterados. Não foi aplicado audit fix, salto major ou downgrade sugerido automaticamente. Ver DEPENDENCIAS.md.
- Carrinhos ainda não preparados continuam em memória: uma instância/processo, perda de sacolas em reinícios e nenhuma garantia de continuidade durante deploy. O resultado das tentativas preparadas é persistente.
- Marcadores legados contendo apenas UUID e segredos de visitante perdidos exigem conferência administrativa; não há associação histórica confiável que permita liberar automaticamente sem risco de duplicação.
- Tentativas preparadas sem confirmação podem aguardar até 15 minutos antes de a verificação encerrá-las com segurança. A interface não repete uma compra incerta automaticamente.
- Rate limits são locais ao processo; proteção distribuída e limites efetivos do ingresso dependem do ambiente. Confirmar IPs reais do proxy antes de publicar.
- Nenhum teste manual de navegador, Safari/iPhone, contraste, layout ou entrega real Resend foi realizado nesta correção. Esses ensaios continuam necessários em homologação. A imagem principal foi mantida para preservar a apresentação.
- A tipagem global não foi convertida para strict: isso é melhoria opcional, sem refatoração ampla nesta entrega.

## Preparação da entrega e publicação

Código validado localmente para revisão/entrega técnica. Não classificar o ambiente publicado como pronto: esta branch não foi publicada. Aplicação em produção exige migrations aditivas, grants, segredos de proxy/admin, configuração Vercel/Render e ensaio funcional autorizados separadamente. Checkout nasce fechado; seguir CHECKOUT-RECOVERY.md para pausa/drenagem e abertura. README documenta a abertura local com NODE_ENV=development, URL loopback e token administrativo, sem alterar o .env existente.

Funcionalidades de usuário conhecidas — catálogo, busca, filtros, autenticação, sacola, checkout visitante, confirmação e envio SMTP/Resend — foram preservadas no novo fluxo. O endpoint antigo POST /finalizar-compra deixa de executar compras e exige frontend atualizado; a alteração é intencional para impedir contorno da idempotência. Testes automatizados não constituem garantia de ausência de regressões em ambientes ainda não ensaiados.

## Arquivos alterados ou adicionados nesta correção

- `README.md`
- `backend/.env.example`
- `backend/.env.production.example`
- `backend/README.md`
- `backend/package.json`
- `backend/scripts/checkout-control.mjs`
- `backend/src/app.setup.ts`
- `backend/src/auth/auth-rate-limit.guard.ts`
- `backend/src/auth/auth.controller.ts`
- `backend/src/auth/auth.module.ts`
- `backend/src/carrinho/carrinho-checkout.service.ts`
- `backend/src/carrinho/carrinho.controller.ts`
- `backend/src/carrinho/carrinho.module.ts`
- `backend/src/carrinho/carrinho.service.spec.ts`
- `backend/src/carrinho/carrinho.service.ts`
- `backend/src/config/environment.spec.ts`
- `backend/src/config/environment.ts`
- `backend/src/database/migrations/1794400000000-CheckoutPersistente.ts`
- `backend/src/database/migrations/1794500000000-ControleCheckout.ts`
- `backend/src/email/confirmacao-pedido.ts`
- `backend/src/email/email.module.ts`
- `backend/src/email/email.service.spec.ts`
- `backend/src/email/email.service.ts`
- `backend/src/email/resend.service.spec.ts`
- `backend/src/email/resend.service.ts`
- `backend/src/finalizar-compra/checkout-deployment.controller.ts`
- `backend/src/finalizar-compra/checkout-deployment.service.ts`
- `backend/src/finalizar-compra/checkout-outbox.service.ts`
- `backend/src/finalizar-compra/checkout-tentativas.controller.ts`
- `backend/src/finalizar-compra/checkout-tentativas.service.ts`
- `backend/src/finalizar-compra/finalizar-compra.controller.ts`
- `backend/src/finalizar-compra/finalizar-compra.module.ts`
- `backend/src/finalizar-compra/finalizar-compra.service.ts`
- `backend/src/security/commerce-rate-limit.spec.ts`
- `backend/src/security/commerce-rate-limit.ts`
- `backend/src/security/proxy-security.ts`
- `backend/test/app.e2e-spec.ts`
- `backend/test/carrinho.e2e-spec.ts`
- `backend/test/checkout-persistente.e2e-spec.ts`
- `backend/test/checkout-security.e2e-spec.ts`
- `backend/test/finalizar-compra.e2e-spec.ts`
- `deploy/CHECKOUT-RECOVERY.md`
- `deploy/DEPENDENCIAS.md`
- `deploy/README.md`
- `deploy/RELATORIO-CORRECOES.md`
- `deploy/postgres/02-runtime-grants.sql`
- `frontend/.env.production.example`
- `frontend/README.md`
- `frontend/api/[...path].js`
- `frontend/eslint.config.js`
- `frontend/package.json`
- `frontend/scripts/api-proxy.check.mjs`
- `frontend/scripts/check-production-env.mjs`
- `frontend/scripts/production-env.check.mjs`
- `frontend/server/api-proxy.mjs`
- `frontend/src/components/CartDrawer.tsx`
- `frontend/src/components/CheckoutSuccess.tsx`
- `frontend/src/hooks/useCarrinhoController.ts`
- `frontend/src/hooks/useCheckout.ts`
- `frontend/src/pages/CheckoutPage.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/checkout-tentativa.ts`
- `frontend/src/services/checkout.ts`
- `frontend/src/test/carrinho.test.tsx`
- `frontend/src/test/checkout.test.tsx`
- `frontend/src/types/checkout.ts`
- `frontend/vercel.json`
- `render.yaml`

## Arquivos locais preexistentes preservados

App.tsx, ProductCard.tsx, carrinho-lock.ts e carrinho.ts mantêm as alterações locais anteriores. CartDiagnostics.tsx, cart-diagnostics.css, carrinho-diagnostico.ts e carrinho-diagnostico.test.tsx continuam presentes sem substituição. useCarrinhoController.ts incorpora as correções mantendo a instrumentação anterior. O arquivo não rastreado com nome semelhante a comando Git foi mantido intacto.

Nenhum arquivo foi staged automaticamente. O working tree contém as correções e os arquivos novos para revisão; main não foi alterada.
