# Alva Modas

E-commerce fictício de moda feminina, desenvolvido para estudo, portfólio e avaliação técnica Full Stack. Não realiza cobranças ou entregas reais.

O monorepositório reúne o catálogo, carrinho, checkout e autenticação de clientes, mantendo a compra como visitante. O front-end utiliza React, TypeScript, Vite e Tailwind CSS. O back-end utiliza NestJS, PostgreSQL, TypeORM, JWT e Nodemailer.

## Organização

| Pasta | Conteúdo |
| --- | --- |
| [frontend](frontend/README.md) | Interface, integração com a API e testes de front-end |
| [backend](backend/README.md) | API REST, entidades, migrations, seed e testes |
| [deploy](deploy/README.md) | Preparação de produção, SMTP e privilégios PostgreSQL |

## Desenvolvimento

Requisitos: Node.js 24.x, mínimo 24.15.0, e PostgreSQL 13 ou superior. A versão validada está em `.nvmrc`. Para capturar e-mails de desenvolvimento, utilize Mailpit ou outro SMTP de testes.

Instale as dependências com `npm ci` em cada projeto. Copie `backend/.env.example` para `backend/.env` e `frontend/.env.example` para `frontend/.env.local`, somente se esses arquivos ainda não existirem. Preencha os valores locais e gere um segredo JWT exclusivo, seguindo o README do back-end. Não reutilize os exemplos como credenciais de produção.

Na pasta `backend`, execute `npm run migration:run` no banco de desenvolvimento configurado e depois `npm run start:dev`. O seed `npm run seed:produtos` é separado e deve ser executado apenas quando desejar cadastrar o catálogo demonstrativo. Na pasta `frontend`, execute `npm run dev`.

Endereços locais: loja em `http://localhost:5173`, API em `http://localhost:3000` e Swagger em `http://localhost:3000/api/docs`. Confirmar um pedido grava dados e desconta estoque; testes manuais devem usar dados isolados.

## Verificação

- Front-end: `npm run build`, `npm run lint` e `npm test`.
- Back-end: `npm run build`, `npm run lint`, `npm test -- --runInBand` e `npm run test:e2e -- --runInBand`.

Os testes automatizados não criam compras no banco configurado pelo `.env`. Consulte [a validação da preparação de produção](deploy/VALIDACAO.md) para os resultados registrados e [a análise de dependências](deploy/DEPENDENCIAS.md) para os alertas moderados ainda pendentes de correção compatível.

## Segurança e publicação

Arquivos `.env` reais, credenciais, dependências instaladas, builds, logs, bancos/dumps, prévias temporárias, backups operacionais e relatórios locais de auditoria não fazem parte do versionamento. Os arquivos `.env.example` e `.env.production.example` são modelos públicos sem segredos utilizáveis.

As configurações Render estão preparadas para revisão em `render.yaml`; criar/aplicar o Blueprint pode iniciar uma publicação. Domínios, secrets, PostgreSQL, SMTP e limitações do carrinho em memória estão descritos no guia de deploy. Não há publicação automática iniciada por este repositório local.
