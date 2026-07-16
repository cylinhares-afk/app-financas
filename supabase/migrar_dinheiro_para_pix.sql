-- Renomeia a opção de meio de pagamento "dinheiro" para "pix" — mesma
-- opção, só o valor armazenado muda (o app não usa dinheiro físico, só
-- PIX). Nenhuma lógica de cálculo muda: essa migração só toca o VALOR
-- salvo em `gastos.meio_pagamento` e `recorrencias.meio_pagamento`.
--
-- Não dá pra simplesmente rodar um UPDATE: o CHECK constraint de cada
-- tabela só aceita 'dinheiro'/'cartao' hoje, então gravar 'pix' violaria
-- esse constraint enquanto ele ainda existir. Por isso a ordem é:
--   1. remover o CHECK de meio_pagamento nas duas tabelas (procurado
--      dinamicamente via pg_constraint, não por nome fixo — evita errar
--      caso o nome gerado automaticamente pelo Postgres seja diferente);
--   2. migrar os dados já existentes;
--   3. recriar o CHECK já restrito a ('pix', 'cartao').
--
-- Rode este arquivo no SQL editor do seu projeto Supabase.
-- ATENÇÃO: mexe em dados existentes. Confirme que está no projeto certo
-- antes de rodar. Depois de rodar (e confirmar com a query no final),
-- atualize também o `supabase/schema.sql` do repo pra refletir 'pix' —
-- já vem atualizado nesse commit, é só pra próximos setups do zero.

begin;

do $$
declare
  nome_constraint text;
begin
  for nome_constraint in
    select conname from pg_constraint
    where conrelid = 'gastos'::regclass
      and pg_get_constraintdef(oid) ilike '%meio_pagamento%'
  loop
    execute format('alter table gastos drop constraint %I', nome_constraint);
  end loop;

  for nome_constraint in
    select conname from pg_constraint
    where conrelid = 'recorrencias'::regclass
      and pg_get_constraintdef(oid) ilike '%meio_pagamento%'
  loop
    execute format('alter table recorrencias drop constraint %I', nome_constraint);
  end loop;
end $$;

update gastos set meio_pagamento = 'pix' where meio_pagamento = 'dinheiro';
update recorrencias set meio_pagamento = 'pix' where meio_pagamento = 'dinheiro';

alter table gastos
  add constraint gastos_meio_pagamento_check check (meio_pagamento in ('pix', 'cartao'));
alter table recorrencias
  add constraint recorrencias_meio_pagamento_check check (meio_pagamento in ('pix', 'cartao'));

commit;

-- Conferência rápida (o primeiro par deve dar 0, o segundo deve bater com
-- o total de lançamentos que eram "dinheiro" antes):
-- select
--   (select count(*) from gastos where meio_pagamento = 'dinheiro') as gastos_dinheiro_restantes,
--   (select count(*) from recorrencias where meio_pagamento = 'dinheiro') as recorrencias_dinheiro_restantes,
--   (select count(*) from gastos where meio_pagamento = 'pix') as gastos_pix,
--   (select count(*) from recorrencias where meio_pagamento = 'pix') as recorrencias_pix;
