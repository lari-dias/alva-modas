# Análise dos alertas de produção

Reconsulta em 11/11/2026, sem alterar dependências ou lockfiles: `npm audit --json` encontrou 10 pacotes moderados no frontend e 29 no backend (24 moderados e 5 baixos), incluindo ferramentas de desenvolvimento. Na auditoria anterior de produção, frontend teve zero e backend três moderados na cadeia descrita abaixo. A contagem inclui propagação transitiva. As sugestões automáticas envolvem também saltos de versão principal e downgrades; não foram aplicadas sem comprovação de compatibilidade. Nenhum `npm audit fix` foi executado. Esses alertas permanecem pendências conhecidas, sem alertas altos ou críticos na consulta.

Verificação em 10/11/2026, usando `npm audit --omit=dev --json`, `npm ls typeorm glob minimatch` e as versões publicadas no registro npm. O resultado do back-end é de três pacotes afetados na mesma cadeia transitiva, não três falhas independentes do código da loja. O front-end não apresentou alertas de produção na auditoria final.

| Pacote instalado | Alerta | Correção publicada | Decisão |
| --- | --- | --- | --- |
| glob 10.5.0, via TypeORM 0.3.31 | [GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4): travessia continua após cancelamento por AbortSignal | glob 14.0.2 | Não impor salto major por override. |
| minimatch 9.0.9, via glob | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249): amplificação de padrões, com consumo de CPU/memória | minimatch 11.0.1 | Não impor salto major por override. |
| TypeORM 0.3.31 | Alerta propagado por glob | npm propõe TypeORM 1.1.2 | Exige migração major e avaliação separada, fora da correção compatível autorizada. |

O registro consultado não contém TypeORM 0.3 posterior a 0.3.31, glob 10 posterior a 10.5.0 ou minimatch 9 posterior a 9.0.9. Portanto, não existe atualização patch/minor publicada nessas linhas que elimine esses alertas. Não foi executado `npm audit fix --force`, adicionado override incompatível ou modificado o lockfile para aparentar resolução.

## Exposição neste projeto

`backend/src/database/database.options.ts` usa padrões fixos definidos pelo código para localizar entidades e migrations. O carregador `typeorm/util/DirectoryExportedClassesLoader.js` instalado chama `glob.sync` com esses caminhos, sem padrões fornecidos pelo cliente e sem AbortSignal. O alerta de minimatch pressupõe controle do padrão pelo atacante; o de glob envolve cancelamento de travessia. A análise dos usos atuais indica exposição limitada nesse caminho, mas não equivale à remoção dos pacotes vulneráveis nem a garantia de ausência de outros usos transitivos.

Manter o artefato da aplicação imutável, não construir padrões a partir de dados HTTP e restringir permissões do processo/usuário do banco. Esses controles reduzem exposição e não substituem a atualização.

## Pendência de publicação

Antes do deploy, registrar a aceitação explícita desse risco residual ou autorizar uma migração de dependências em trabalho separado. A alternativa é aguardar backport oficial nas versões compatíveis. Reconsultar os avisos na data da publicação; depois de qualquer atualização, repetir builds, lint, testes e uma validação real isolada de migrations, autenticação, compra e SMTP.
