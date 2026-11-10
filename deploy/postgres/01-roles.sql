\set ON_ERROR_STOP on
\if :{?target_database}
\else
  \echo 'Informe -v target_database=NOME_DO_BANCO_DE_PRODUCAO.'
  \quit 1
\endif

SELECT current_database() = :'target_database' AS target_ok \gset
\if :target_ok
\else
  \echo 'Banco conectado diferente do destino confirmado. Nenhuma alteracao executada.'
  \quit 1
\endif

BEGIN;
CREATE ROLE alva_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
CREATE ROLE alva_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
REVOKE ALL ON DATABASE :"target_database" FROM PUBLIC;
GRANT CONNECT ON DATABASE :"target_database" TO alva_migrator, alva_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE, CREATE ON SCHEMA public TO alva_migrator;
GRANT USAGE ON SCHEMA public TO alva_app;
COMMIT;

SET password_encryption = 'scram-sha-256';
\password alva_migrator
\password alva_app
