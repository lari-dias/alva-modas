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
GRANT SELECT ON TABLE public.produtos TO alva_app;
GRANT UPDATE (estoque, "atualizadoEm") ON TABLE public.produtos TO alva_app;
GRANT SELECT, INSERT ON TABLE public.clientes, public.pedidos, public.itens_pedido TO alva_app;
GRANT USAGE ON TYPE public.status_pedido_enum TO alva_app;
GRANT SELECT, INSERT, UPDATE ON TABLE public.checkout_tentativas, public.checkout_carrinhos, public.email_outbox TO alva_app;
GRANT SELECT, UPDATE ON TABLE public.checkout_controle TO alva_app;
COMMIT;

SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolreplication, rolbypassrls
FROM pg_roles WHERE rolname IN ('alva_app', 'alva_migrator');
SELECT has_schema_privilege('alva_app', 'public', 'CREATE') AS app_can_create_objects;
