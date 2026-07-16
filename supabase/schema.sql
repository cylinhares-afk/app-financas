-- Schema inicial do app de finanças pessoais.
-- Rode este arquivo no SQL editor do seu projeto Supabase.
--
-- Modelo: 2 usuários (casal) compartilhando os mesmos dados em tempo real.
-- O "orçamento diário" NÃO é armazenado aqui — é sempre calculado em runtime
-- a partir de previsoes_mensais + gastos + dia atual (ver src/features/budget/calculations.ts).
--
-- Login: por enquanto é 1 único login (mesmo e-mail/senha) compartilhado pelos 2,
-- criado direto no Supabase Auth — por isso `usuarios` NÃO referencia auth.users:
-- são só os 2 perfis usados para marcar "quem lançou" cada gasto/entrada.
-- Se no futuro cada pessoa passar a ter conta própria, aí sim ligamos usuarios.id ao auth.users.id.

create extension if not exists "pgcrypto";

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

create table if not exists categorias (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  cor text,
  criado_em timestamptz not null default now()
);

-- Valor previsto por categoria, por mês. Um registro por (categoria, ano, mes).
create table if not exists previsoes_mensais (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias (id) on delete cascade,
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor_previsto numeric(12, 2) not null default 0,
  criado_em timestamptz not null default now(),
  unique (categoria_id, ano, mes)
);

-- Compra parcelada como entidade própria (não "repetir gasto por X meses").
create table if not exists compras_parceladas (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias (id) on delete restrict,
  descricao text,
  valor_total numeric(12, 2) not null,
  numero_parcelas int not null check (numero_parcelas > 0),
  data_compra date not null,
  criado_em timestamptz not null default now()
);

-- Movimento recorrente (assinatura, aluguel, salário etc.) — diferente de compra
-- parcelada: valor se repete igual a cada ocorrência, por X vezes ou por tempo
-- indeterminado (numero_ocorrencias nulo). Serve tanto pra saída (categoria_id +
-- meio_pagamento obrigatórios) quanto pra entrada (nenhum dos dois; descricao
-- guarda a origem, ex: "Salário Cynthia"). As ocorrências concretas viram linhas
-- em `gastos` ou `entradas` (uma por vez), geradas conforme o tempo passa — ver
-- src/features/lancamento/gerarOcorrenciasRecorrentes.ts.
create table if not exists recorrencias (
  id uuid primary key default gen_random_uuid(),
  tipo_movimento text not null check (tipo_movimento in ('entrada', 'saida')),
  categoria_id uuid references categorias (id) on delete restrict, -- só p/ saída
  usuario_id uuid not null references usuarios (id) on delete restrict,
  valor numeric(12, 2) not null,
  meio_pagamento text check (meio_pagamento in ('pix', 'cartao')), -- só p/ saída
  descricao text, -- origem da entrada, ex: "Salário Cynthia"
  frequencia text not null check (frequencia in ('diaria', 'semanal', 'mensal')),
  data_inicio date not null,
  numero_ocorrencias int, -- null = indeterminado
  criado_em timestamptz not null default now()
);

-- Lançamentos reais de gastos. Quando vem de uma compra parcelada,
-- compra_parcelada_id + numero_parcela identificam a posição (ex: parcela 3 de 4).
-- Quando vem de uma recorrência, recorrencia_id + numero_ocorrencia identificam
-- qual ocorrência é (ex: a 5ª cobrança da assinatura).
create table if not exists gastos (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references categorias (id) on delete restrict,
  usuario_id uuid not null references usuarios (id) on delete restrict,
  valor numeric(12, 2) not null,
  data date not null,
  descricao text, -- nota livre do lançamento (ex: "ração, areia, churu — compra grande do mês")
  meio_pagamento text not null check (meio_pagamento in ('pix', 'cartao')),
  compra_parcelada_id uuid references compras_parceladas (id) on delete cascade,
  numero_parcela int,
  recorrencia_id uuid references recorrencias (id) on delete cascade,
  numero_ocorrencia int,
  criado_em timestamptz not null default now()
);

create index if not exists gastos_categoria_data_idx on gastos (categoria_id, data);
create index if not exists gastos_compra_parcelada_idx on gastos (compra_parcelada_id);
create index if not exists gastos_recorrencia_idx on gastos (recorrencia_id);

-- Receitas do mês. Quando vem de uma recorrência (ex: salário mensal),
-- recorrencia_id + numero_ocorrencia identificam qual ocorrência é.
create table if not exists entradas (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references usuarios (id) on delete restrict,
  valor numeric(12, 2) not null,
  data date not null,
  descricao text,
  recorrencia_id uuid references recorrencias (id) on delete cascade,
  numero_ocorrencia int,
  criado_em timestamptz not null default now()
);

create index if not exists entradas_recorrencia_idx on entradas (recorrencia_id);

-- Grants: RLS por si só não dá acesso a nada — sem isso o Postgres barra
-- a tabela inteira ("permission denied") antes mesmo de avaliar as policies.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  usuarios, categorias, previsoes_mensais, compras_parceladas, gastos, entradas, recorrencias
  to authenticated;

-- RLS: os dados são compartilhados entre os 2 usuários da casa.
-- Qualquer usuário autenticado (ou seja, um dos 2 do casal) pode ler e escrever tudo.
alter table usuarios enable row level security;
alter table categorias enable row level security;
alter table previsoes_mensais enable row level security;
alter table compras_parceladas enable row level security;
alter table gastos enable row level security;
alter table entradas enable row level security;
alter table recorrencias enable row level security;

-- `create policy` não tem "if not exists" — o drop antes garante que rodar
-- este arquivo de novo (ex: depois de adicionar uma seção nova, como
-- Economias) nunca quebre por policy já existente.
drop policy if exists "usuarios autenticados leem tudo" on usuarios;
create policy "usuarios autenticados leem tudo" on usuarios for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem categorias" on categorias;
create policy "usuarios autenticados leem categorias" on categorias for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem categorias" on categorias;
create policy "usuarios autenticados escrevem categorias" on categorias for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem previsoes" on previsoes_mensais;
create policy "usuarios autenticados leem previsoes" on previsoes_mensais for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem previsoes" on previsoes_mensais;
create policy "usuarios autenticados escrevem previsoes" on previsoes_mensais for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem compras parceladas" on compras_parceladas;
create policy "usuarios autenticados leem compras parceladas" on compras_parceladas for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem compras parceladas" on compras_parceladas;
create policy "usuarios autenticados escrevem compras parceladas" on compras_parceladas for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem gastos" on gastos;
create policy "usuarios autenticados leem gastos" on gastos for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem gastos" on gastos;
create policy "usuarios autenticados escrevem gastos" on gastos for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem entradas" on entradas;
create policy "usuarios autenticados leem entradas" on entradas for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem entradas" on entradas;
create policy "usuarios autenticados escrevem entradas" on entradas for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem recorrencias" on recorrencias;
create policy "usuarios autenticados leem recorrencias" on recorrencias for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem recorrencias" on recorrencias;
create policy "usuarios autenticados escrevem recorrencias" on recorrencias for all using (auth.role() = 'authenticated');

-- Os 2 perfis da casa, usados para marcar "quem lançou" cada gasto/entrada.
-- Troque os nomes abaixo pelos nomes de vocês antes de rodar (ou edite depois direto na tabela).
insert into usuarios (nome)
select nome from (values ('Cynthia'), ('Parceiro(a)')) as seed (nome)
where not exists (select 1 from usuarios);

-- Economias (reserva de emergência) + fechamento de mês.
--
-- economias_saldo_inicial: linha única com o valor cadastrado manualmente
-- como ponto de partida da reserva (ex: os R$12.000 que já existem hoje).
-- economias_movimentos: histórico mês a mês de aportes (valor positivo) e
-- retiradas (valor negativo) — normalmente um por fechamento de mês
-- confirmado, mas a coluna `origem` deixa espaço pra ajuste manual futuro.
-- Saldo da reserva = saldo_inicial + soma dos movimentos.
--
-- fechamentos_mensais: registra que o fechamento de um mês já foi
-- OFERECIDO ao usuário (independente da resposta) — existir a linha é o que
-- impede o app de perguntar de novo sobre aquele mês. `confirmado` é o que
-- efetivamente quebra o encadeamento do saldo acumulado da Home pro mês
-- seguinte (ver calcularMesesAnteriores / proximoSaldoInicial em
-- src/features/home/linhasDoMes.ts).
create table if not exists economias_saldo_inicial (
  id boolean primary key default true,
  valor numeric(12, 2) not null default 0,
  atualizado_em timestamptz not null default now(),
  constraint economias_saldo_inicial_singleton check (id)
);

create table if not exists economias_movimentos (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null check (mes between 1 and 12),
  valor numeric(12, 2) not null, -- positivo = aporte, negativo = retirada
  origem text not null default 'fechamento_mes' check (origem in ('fechamento_mes', 'manual')),
  criado_em timestamptz not null default now()
);

create table if not exists fechamentos_mensais (
  id uuid primary key default gen_random_uuid(),
  ano int not null,
  mes int not null check (mes between 1 and 12),
  performance numeric(12, 2) not null,
  confirmado boolean not null,
  criado_em timestamptz not null default now(),
  unique (ano, mes)
);

insert into economias_saldo_inicial (id, valor)
values (true, 0)
on conflict (id) do nothing;

grant select, insert, update, delete on
  economias_saldo_inicial, economias_movimentos, fechamentos_mensais
  to authenticated;

alter table economias_saldo_inicial enable row level security;
alter table economias_movimentos enable row level security;
alter table fechamentos_mensais enable row level security;

drop policy if exists "usuarios autenticados leem saldo inicial de economias" on economias_saldo_inicial;
create policy "usuarios autenticados leem saldo inicial de economias" on economias_saldo_inicial for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem saldo inicial de economias" on economias_saldo_inicial;
create policy "usuarios autenticados escrevem saldo inicial de economias" on economias_saldo_inicial for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem movimentos de economias" on economias_movimentos;
create policy "usuarios autenticados leem movimentos de economias" on economias_movimentos for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem movimentos de economias" on economias_movimentos;
create policy "usuarios autenticados escrevem movimentos de economias" on economias_movimentos for all using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados leem fechamentos mensais" on fechamentos_mensais;
create policy "usuarios autenticados leem fechamentos mensais" on fechamentos_mensais for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem fechamentos mensais" on fechamentos_mensais;
create policy "usuarios autenticados escrevem fechamentos mensais" on fechamentos_mensais for all using (auth.role() = 'authenticated');

-- Cartões (fechamento/vencimento reais) + a referência de cada gasto/
-- recorrência ao cartão usado, pra calcular em qual mês a fatura
-- efetivamente vence (ver src/features/cartoes/faturaCartao.ts) em vez de
-- assumir sempre "mês seguinte à compra" como antes.
create table if not exists cartoes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  dia_fechamento int not null check (dia_fechamento between 1 and 31),
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  criado_em timestamptz not null default now()
);

-- on delete restrict: um cartão só pode ser excluído se não tiver nenhum
-- gasto/recorrência referenciando ele (ver TelaCartoes — a exclusão falha
-- com um erro amigável nesse caso, em vez de apagar o rastro do gasto).
alter table gastos add column if not exists cartao_id uuid references cartoes (id) on delete restrict;
alter table recorrencias add column if not exists cartao_id uuid references cartoes (id) on delete restrict;

grant select, insert, update, delete on cartoes to authenticated;

alter table cartoes enable row level security;

drop policy if exists "usuarios autenticados leem cartoes" on cartoes;
create policy "usuarios autenticados leem cartoes" on cartoes for select using (auth.role() = 'authenticated');
drop policy if exists "usuarios autenticados escrevem cartoes" on cartoes;
create policy "usuarios autenticados escrevem cartoes" on cartoes for all using (auth.role() = 'authenticated');

-- Categoria "excluída" é só arquivada (ativa = false), nunca apagada de
-- verdade — os gastos antigos continuam com a mesma categoria_id válida
-- (histórico intacto), a categoria só some dos pickers de novo lançamento
-- e da edição de previsão futura (ver src/features/budget/TelaCategorias.tsx).
alter table categorias add column if not exists ativa boolean not null default true;

-- Snapshot do fechamento/vencimento do cartão NO MOMENTO da compra — editar
-- um cartão depois não pode mudar retroativamente em qual mês uma compra
-- já lançada vence (ver src/features/cartoes/faturaCartao.ts). Nulo pra
-- gastos via pix, ou lançados antes dessa coluna existir (nesse caso o
-- cálculo cai num fallback, ver faturaCartao.ts).
alter table gastos add column if not exists cartao_dia_fechamento int;
alter table gastos add column if not exists cartao_dia_vencimento int;
