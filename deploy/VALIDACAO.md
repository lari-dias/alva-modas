# Validação da preparação de produção

Data: 10/11/2026. Nenhum serviço externo, domínio, banco ou deploy foi criado.

| Verificação | Resultado |
| --- | --- |
| Back-end: build | Aprovado |
| Back-end: lint sem correções automáticas | Aprovado |
| Back-end: testes unitários | 98 aprovados, 11 suítes |
| Back-end: testes HTTP | 49 aprovados, 5 suítes |
| Front-end: build local | Aprovado |
| Front-end: build:prod | Aprovado com origem HTTPS de teste fornecida apenas ao processo |
| Front-end: lint | Aprovado |
| Front-end: Vitest | 70 aprovados, 5 arquivos |
| Front-end: validação do ambiente de build | 4 aprovados, node:test |
| Total de testes | **221 aprovados** |
| render.yaml | Validado localmente contra o JSON Schema oficial do Render com ferramentas já instaladas |

Os 201 testes da auditoria anterior foram preservados. Os 20 novos casos cobrem restrições de produção, TLS PostgreSQL e CA, STARTTLS sem fallback inseguro, confiança limitada nos headers do proxy e validação da URL pública antes do build.

As declarações de dependências do front-end continuam compatíveis com o lockfile. Não houve instalação/atualização de bibliotecas nem alteração de lockfiles. O diagnóstico de dependências está em [DEPENDENCIAS.md](DEPENDENCIAS.md); os três alertas moderados permanecem pendentes de backport compatível ou decisão separada sobre atualização major.

## Resolvido no repositório

- Blueprint de API Render com uma instância, deploys automáticos desativados, Node fixado, health check existente e build sem dependências de desenvolvimento no runtime.
- Front-end estático com fallback das rotas React e validação de VITE_API_URL no comando de produção.
- Modelos de ambiente separados, sem segredos e sem sobrescrever os arquivos locais.
- Validação de HTTPS/CORS restrito, TLS PostgreSQL com certificado verificado e suporte a CA adicional.
- Configuração explícita de proxy e TLS obrigatório para SMTP autenticado em produção.
- Scripts de provisionamento de papéis e grants mínimos, destinados somente ao ambiente de produção confirmado.
- Guia de SMTP real/capturador privado, limitações de carrinho em memória e operação de releases.
- READMEs corrigidos sobre transações e distinção dos códigos 404.

## Configuração externa pendente

- Seleção e criação dos recursos pagos previstos, região e domínio(s) no mesmo site, DNS e certificados.
- Provisionamento do PostgreSQL, execução dos scripts de papéis/grants, migrations com papel separado e teste real da conexão TLS/SNI/CA.
- Preenchimento de FRONTEND_URL, VITE_API_URL e secrets no ambiente de hospedagem; confirmação do número de proxies confiáveis.
- Provedor SMTP autorizado ou capturador privado ativo e acessível à API.
- Revisão do risco residual de dependências antes da publicação.
- Após autorização do deploy, validação remota de rotas diretas, cookie, SMTP e fluxo de compra com dados isolados.

O banco local, seu usuário, seus registros e os arquivos `.env`/`.env.local` não foram alterados. Não foram executadas compras reais, migrations, seed ou SQL de provisionamento. As configurações de TLS e infraestrutura foram verificadas por testes e schema locais; conectividade e comportamento da hospedagem só podem ser confirmados depois de provisionar o ambiente autorizado.

## Arquivos envolvidos

- Raiz: `render.yaml`.
- Deploy: `README.md`, `DEPENDENCIAS.md`, este relatório e `postgres/01-roles.sql`, `postgres/02-runtime-grants.sql`.
- Back-end: `.gitignore`, `.env.example`, `.env.production.example`, `README.md`, `src/config/environment.ts` e seus testes, `src/database/database.options.ts` e seus testes, `src/app.setup.ts`, `src/auth/auth.module.ts`, `src/main.ts`, `src/email/smtp.provider.ts`, `src/email/email.service.spec.ts`, `test/proxy.e2e-spec.ts`.
- Front-end: `.gitignore`, `.env.production.example`, `README.md`, `package.json`, `eslint.config.js`, `scripts/check-production-env.mjs`, `scripts/production-env.check.mjs`.
