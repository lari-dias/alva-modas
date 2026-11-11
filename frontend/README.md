# Alva Modas — Front-end

Interface em React, TypeScript e Vite, com Tailwind CSS 4.3.5, baseada no styleboard oficial Alva Modas em Borgonha. Inclui faixa superior, header, hero, benefícios, catálogo, carrinho e checkout integrados à API e rodapé. Não há gateway de pagamento.

## Executar

Na pasta `frontend`, com Node.js 24.x (mínimo 24.15.0; versão validada: 24.18.0, definida no `.nvmrc` da raiz). Essa versão atende aos requisitos de Vite, Vitest e jsdom, além do back-end:

```powershell
npm.cmd install
Copy-Item .env.example .env.local
npm.cmd run dev
```

O Vite utiliza `http://localhost:5173` por padrão. Configure `VITE_API_URL` no `.env.local` com a origem do NestJS:

```dotenv
VITE_API_URL=http://localhost:3000
```

`src/services/api.ts` exporta `API_URL`, com esse mesmo endereço como padrão e sem barra final. Reinicie o Vite após alterar variáveis de ambiente. Variáveis `VITE_*` são públicas e incluídas no bundle: não coloque senhas ou credenciais nelas.

Para produção, siga o [guia de hospedagem](../deploy/README.md) e o `render.yaml` da raiz. Defina a URL HTTPS real em `VITE_API_URL` no ambiente de build e execute `npm.cmd run build:prod`. O comando valida a origem e recusa localhost, HTTP, credenciais, caminhos e placeholders conhecidos. `.env.production.example` é somente um modelo; `.env.local` permanece para desenvolvimento. O perfil Render Static Site publica `dist` e reescreve rotas React para `/index.html`, preservando o acesso direto a `/conta`, `/cadastro` e `/checkout`. Domínios, DNS e HTTPS devem ser configurados externamente antes da publicação.

Mantenha o NestJS em execução na origem configurada. Abra o front-end em `http://localhost:5173`, a origem já permitida pelo CORS do back-end. Se usar outra origem ou porta, ela precisa estar autorizada no servidor; não há proxy ou tentativa de contornar CORS no cliente.

## Organização

```text
src/
  assets/       Imagens, ícones e outros arquivos estáticos importados
  components/   Componentes reutilizáveis
  contexts/     Contrato compartilhado do carrinho
  hooks/        Consultas, mutations e controle de foco do drawer
  pages/        Páginas, começando por HomePage.tsx
  providers/    Estado compartilhado do carrinho
  services/     Comunicação HTTP, formatação de preços e QueryClient
  types/        Tipos compartilhados e declaração de VITE_API_URL
  test/         Configuração, fixtures e testes de integração do front-end
  App.tsx       Composição principal
  index.css     Tailwind, tokens visuais e estilos globais
  main.tsx      Inicialização do React
```

Pastas ainda sem implementação possuem `.gitkeep`. React Router mantém as rotas `/` e `/checkout` sem recarregar a HomePage. O serviço HTTP continua usando `fetch`.

## Interface e catálogo da API

Abra a URL indicada pelo Vite, normalmente `http://localhost:5173`. A página é composta por `AnnouncementBar`, `Header`, `Hero`, `Benefits`, `ProductSection`, `ProductCard` e `Footer`; `Brand` compartilha a marca entre o header e o rodapé.

O grid usa quatro colunas a partir de 1024px, três no tablet e duas abaixo de 768px. O header mobile possui menu hambúrguer; o hero mantém o texto à esquerda e adapta o enquadramento da modelo. A navegação e o CTA do hero levam às seções locais.

O arquivo temporário de produtos foi removido. A única fonte do catálogo é `GET /produtos`, acessado por `src/services/produtos.ts`. O serviço verifica o status HTTP e o contrato da resposta, preservando UUIDs, nomes, descrições, preços decimais como strings, URLs, categorias, estoque e a ordem retornada pelo NestJS.

O hook `src/hooks/useProdutos.ts` utiliza TanStack Query e compartilha a chave `['produtos']`. O provider fica em `main.tsx` e a configuração em `src/services/query-client.ts`: dados considerados recentes por 60 segundos, uma repetição automática em caso de falha e sem nova consulta ao focar a janela. A requisição aceita cancelamento e tem timeout de 10 segundos. O cache é somente em memória e contém respostas reais da API, sem dados fictícios ou fallback local.

A `HomePage` concentra a consulta e passa dados e estados ao `ProductSection`. Enquanto carrega, a seção informa o carregamento; em falhas HTTP, rede, CORS ou resposta inválida, mostra uma mensagem genérica com botão **Tentar novamente**; uma resposta `[]` mostra **Nenhum produto disponível no momento**. O `ProductCard` e seus estilos aprovados permanecem os mesmos.

Imagens de produtos continuam hospedadas no Pexels, conforme o seed existente; sua disponibilidade depende do provedor. O hero é um asset local preparado a partir da referência oficial com imagegen. O prompt e a origem estão em `src/assets/images/README.md`.

A lupa abre a pesquisa por nome e descrição, sem diferenciar caixa ou acentos. As categorias são extraídas dos produtos da API e combinadas com a busca no navegador. Os parâmetros `busca` e `categoria` ficam na URL, por exemplo `/?busca=bege&categoria=Cal%C3%A7as#produtos`, permitindo reabrir a seleção. “Limpar filtros” e “Nossas peças” restauram o catálogo completo. Não há endpoints novos ou dados fictícios como fallback.

Favoritos e promoções continuam com controles desabilitados e descrição de disponibilidade futura. Minha conta está integrada ao cadastro e login. O botão de adicionar ao carrinho está integrado à API e o contador da sacola usa as quantidades confirmadas pelo servidor. Não há cobrança real ou descontos aplicados. Os cards reservam espaço para condições de pagamento sem anunciar parcelamento não implementado. A faixa e os benefícios identificam o ambiente demonstrativo, sem prometer frete, parcelamento ou cupons.

## Cadastro e login

O ícone Minha conta funciona em desktop e mobile e abre `/conta`. O link Criar conta abre `/cadastro`, com nome, e-mail, senha e confirmação validados por React Hook Form + Zod. Login usa e-mail e senha. Após autenticar, a página exibe nome/e-mail e permite sair. A navegação de catálogo, sacola e checkout continua acessível sem login; entrar ou sair não remove itens da sacola.

`services/auth.ts` concentra as chamadas `/auth/cadastro`, `/auth/login`, `/auth/me` e `/auth/logout`, com `credentials: include`. `useAuthController` usa TanStack Query para a sessão e mutations sem repetição automática, com bloqueio de envios simultâneos. `AuthProvider` compartilha o estado e `AuthForm` apresenta campos e mensagens acessíveis. O JWT fica em cookie HttpOnly gerenciado pela API, sem persistência de senha, token ou dados do cliente em localStorage/sessionStorage. O armazenamento do carrinho permanece independente.

Não há segredo a configurar no front-end: mantenha apenas `VITE_API_URL`. Configure `JWT_SECRET`, o cookie e a migration de clientes no back-end conforme seu README. Use `http://localhost:5173` e `http://localhost:3000` juntos, sem alternar localhost e 127.0.0.1. A implantação deve manter ambos no mesmo site HTTPS (ou proxy de mesma origem), respeitando SameSite=Strict e CORS credenciado.

Para validar no navegador, abra `/conta`, navegue até Criar conta e, em um banco de desenvolvimento, cadastre uma conta com senha de 8–128 caracteres. Confira o estado autenticado, recarregue a página e teste Sair/Entrar. Isso grava somente o cliente; não confirme pedidos para testar autenticação. Os testes automatizados simulam as respostas HTTP e verificam validação, duplicidade de envio, erros, restauração de sessão, logout e preservação da compra como visitante. Não há recuperação de senha, histórico, favoritos ou painel administrativo.

O identificador só é descartado automaticamente quando a API retorna `code: CART_NOT_FOUND`. Erros de produto preservam o carrinho. Reduções e aumentos consultam o estado atual do servidor dentro do Web Lock antes do PUT; falha na consulta preserva a sacola sem usar quantidade de cache desatualizada. Itens com `disponivel: false` permanecem visíveis para correção, com checkout bloqueado até a recuperação.

O rodapé segue a mesma marca, tipografia e paleta; a referência não mostra o rodapé completo. A lateral com paleta/tipografia e a moldura de celular do styleboard não fazem parte da interface da loja.

## Tokens visuais

O Tailwind 4 usa o plugin `@tailwindcss/vite` e `@import 'tailwindcss'`. Os tokens ficam no bloco `@theme` de `src/index.css`, sem arquivo de configuração legado.

| Token | Cor | Exemplo de classe |
| --- | --- | --- |
| background | #FDF8FA | `bg-background` |
| surface | #F2E7ED | `bg-surface` |
| detail | #E1C8D2 | `bg-detail` |
| primary | #A64D79 | `text-primary` |
| wine | #7B2D54 | `text-wine` |
| foreground | #2D1A24 | `text-foreground` |
| muted | #6B4B58 | `text-muted` |
| border | #E8D9DE | `border-border` |

As variáveis CSS correspondentes são `--color-background`, `--color-primary` e assim por diante. Títulos usam Playfair Display (`font-display`) e os demais textos usam Inter (`font-sans`). As fontes são carregadas pelo Google Fonts com `display=swap`; sem acesso à rede, são usadas Georgia e a fonte padrão do sistema.

## Verificação

```powershell
npm.cmd run build
npm.cmd run lint
npm.cmd test
```

O build executa a checagem TypeScript e gera `dist/`. `npm.cmd run preview` serve o resultado localmente.

Vitest, Testing Library, user-event, jest-dom e jsdom estão configurados em `vitest.config.ts`. `npm.cmd test` executa a suíte; `npm.cmd run test:watch` executa em modo interativo. Os testes usam respostas HTTP simuladas, sem conexão ao PostgreSQL ou à API real. Cobrem adição, aumento, diminuição, remoção, total do servidor, limites de estoque, erros HTTP/rede, resposta inválida, expiração, 404 de produto sem perder o carrinho, operações concorrentes, sincronização de UUID entre abas e foco/Escape do drawer. Os testes de checkout incluem formulário, carrinho vazio/expirado, confirmação, loading, rejeições da API, três estados de e-mail, envio duplicado, resultado incerto após reload, limpeza da sacola e navegação de volta à loja.

Para conferir o catálogo, abra **Network** nas ferramentas do navegador: a consulta deve ser `GET <VITE_API_URL>/produtos` e os cards devem refletir a resposta real. Estados de carregamento, falha e lista vazia podem ser verificados com interceptação de respostas apenas no navegador de teste, sem alterar registros ou interromper o servidor da API.

## Carrinho integrado

O `CarrinhoProvider`, dentro do `QueryClientProvider`, compartilha um único controlador entre cards, header e drawer. O serviço `src/services/carrinho.ts` valida as respostas e realiza somente `POST`, `GET` e `PUT /carrinho`, utilizando `VITE_API_URL`. Os componentes recebem ações pelo hook `useCarrinho`, sem fazer requisições diretamente.

Na primeira adição, o POST envia apenas `produtoId` e `quantidade: 1`, sem `X-Cart-Id`. O UUID retornado é salvo na chave `alva-modas:cart-id` do localStorage. As próximas requisições enviam esse identificador no header. Nenhum produto, nome, preço, subtotal ou total é persistido no localStorage. O cache do TanStack Query existe somente em memória. Se o navegador bloquear o armazenamento, o identificador permanece apenas em memória e é perdido ao recarregar a página.

Ao clicar na sacola, o drawer consulta novamente os dados atuais. Adicionar, aumentar, diminuir e remover usam mutations com invalidação do cache. A alteração de quantidade consulta o carrinho antes de enviar a nova quantidade absoluta; diminuir de 1 para 0 também remove o produto. A remoção explícita envia zero diretamente, permitindo remover um item que ficou indisponível. Os valores mostrados são `precoUnitarioCentavos`, `subtotalCentavos` e `totalCentavos` retornados pelo back-end; o navegador apenas formata os centavos em reais.

Os controles respeitam os limites conhecidos da API: 20 produtos distintos, 100 unidades totais e 100 unidades por item, além do estoque retornado. Todas as alterações são validadas novamente pelo servidor e o carrinho não reserva estoque. Em caso de erro numa nova consulta, dados previamente confirmados podem permanecer visíveis em memória com o aviso e a indicação **Último total confirmado**, sem afirmar que o valor está atualizado.

### Expiração e recuperação

Somente o código `CART_NOT_FOUND` invalida o UUID, em GET, POST ou PUT. `PRODUCT_NOT_FOUND` e `CART_ITEM_NOT_FOUND` indicam problemas de produto e preservam um carrinho válido, sem descartá-lo por um 404 genérico. Nenhum item é recriado ou recuperado automaticamente. **Começar novo carrinho** descarta o identificador/cache local após uma ação explícita e deixa a sacola vazia; um novo UUID só será criado pelo servidor na próxima adição. Isso não exclui nem altera registros no PostgreSQL.

Itens indisponíveis permanecem visíveis para redução ou remoção, inclusive quando outros produtos do carrinho também estiverem inválidos. A API pode retornar `disponivel: false` e os últimos dados conhecidos para produtos excluídos; o front-end não inventa itens a partir do catálogo. Adições, aumentos de quantidade e checkout continuam revalidando disponibilidade e estoque atuais no banco. Reinício da API perde o Map em memória e retorna `CART_NOT_FOUND`; essa limitação deve ser considerada na janela de publicação.

### Concorrência

As mutations compartilham um `scope` de serialização no TanStack Query. Todas as operações do carrinho também usam um bloqueio `navigator.locks` na mesma origem quando disponível, incluindo entre abas. O identificador é lido novamente dentro do bloqueio: duas primeiras adições aguardam a resposta anterior e reutilizam o primeiro UUID, em vez de criar carrinhos independentes. Sem Web Locks, uma fila em memória protege as requisições da aba, mas não garante exclusão entre abas. A mudança de UUID em outra aba é recebida pelo evento `storage`; atualizações de itens com o mesmo UUID são reconsultadas ao abrir o drawer.

POST e PUT não têm repetição automática nem atualização otimista de produtos ou valores. Em falhas de rede, a operação pode ter sido aceita pelo servidor sem a resposta chegar: consulte o carrinho antes de repetir. Se isso ocorrer na primeira adição antes de receber o UUID, não há como recuperar aquele carrinho automaticamente com o contrato atual. O carrinho órfão expira no servidor e não reserva estoque. A proteção não cobre outros navegadores/dispositivos que operem o mesmo UUID sem usar o mesmo bloqueio; conflitos 409 são apresentados ao usuário. Não há promessa de idempotência persistente.

### Acessibilidade e visualização

O drawer usa `<dialog>` modal, foco inicial no botão de fechar, contenção de Tab/Shift+Tab, fechamento por Escape, botão ou clique no fundo e retorno de foco ao acionador. A página atrás fica inerte e a rolagem é bloqueada enquanto o drawer está aberto. O estilo utiliza os mesmos tokens vinho/rosé e ocupa a tela toda no mobile, com largura máxima de 460px no desktop.

Para testar manualmente, mantenha a API em execução e abra `http://localhost:5173`: adicione uma peça, confira o feedback confirmado, altere a quantidade, remova o item e reabra a sacola. As requisições devem conter somente produto/quantidade, com `X-Cart-Id` após a primeira resposta. O botão **Finalizar compra** fica disponível somente com itens confirmados e sem operações/erros pendentes; ele abre `/checkout`, sem registrar um pedido ainda.

## Checkout

CheckoutPage preserva header, rodapé, resumo e formulário existentes. Nome e e-mail são validados por React Hook Form/Zod e pelo backend. O navegador não envia preços ou totais.

useCheckout consulta a disponibilidade, registra uma tentativa versionada no localStorage e prepara/confirma a mesma chave persistente no backend. O registro contém UUID da tentativa, UUID da sacola, token aleatório de recuperação e indicação de autenticação; não contém nome, e-mail ou valores. O token de visitante é uma credencial: não compartilhar nem registrar em logs.

Falhas de rede, timeout e respostas inválidas preservam a tentativa e bloqueiam alterações da sacola. Verificar confirmação consulta o resultado persistido: CONFIRMADA mostra o pedido; ENCERRADA_SEM_PEDIDO libera a sacola; PROCESSANDO mantém a proteção. Não há reenvio automático ao reconectar. Falhas após preparar podem permanecer em processamento por até 15 minutos antes do encerramento seguro, se a confirmação não tiver sido executada.

Tentativas autenticadas exigem login na mesma conta. Marcadores legados contendo somente UUID ou tokens perdidos não podem ser associados com segurança aos pedidos históricos: precisam de conferência administrativa; não limpar o armazenamento para refazer compra incerta.

CheckoutSuccess mostra o total confirmado e distingue e-mail pendente, aceito pela API, aceito por SMTP e falha. Nenhum pagamento é realizado. O envio é recuperado pela outbox do backend.

Em produção, VITE_API_URL=/api e a função Vercel implementam o proxy de mesma origem, preservando cookies fortes. API_UPSTREAM_URL, STOREFRONT_ORIGIN e API_PROXY_SECRET são exclusivos do servidor, nunca VITE_*. O vercel.json mantém o fallback da SPA sem encaminhar rotas administrativas. Consulte [CHECKOUT-RECOVERY.md](../deploy/CHECKOUT-RECOVERY.md) para configuração.

Os testes frontend simulam respostas HTTP e caches independentes; não comprovam comportamento de abas, layout ou cookies em navegador real. Para ensaio manual, use banco isolado: confirmar pedido grava dados e desconta estoque. Não foi realizado ensaio manual em produção nesta correção.
