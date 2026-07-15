-- Limpeza dos dados de teste/mock, mantendo intactos:
--   - categorias (nomes, cor, ativa)
--   - cartoes (nome, dia_fechamento, dia_vencimento)
--   - usuarios (os 2 perfis)
--
-- Apaga por completo:
--   - entradas e gastos (todos os lançamentos, inclusive os gerados por
--     recorrência ou por parcela de compra parcelada)
--   - recorrencias e compras_parceladas cadastradas
--   - previsoes_mensais (categorias voltam a não ter previsto definido em
--     nenhum mês — o cadastro de previsão recomeça do zero)
--   - economias_movimentos e fechamentos_mensais (histórico de fechamento de
--     mês já confirmado)
--
-- economias_saldo_inicial NÃO é apagada (é uma linha única — singleton —
-- que o app espera que sempre exista, ver schema.sql), só tem o valor
-- zerado de volta.
--
-- Ordem respeita as foreign keys: entradas/gastos são apagados primeiro
-- (são quem referencia recorrencias/compras_parceladas), só depois as
-- tabelas "pai" — evita qualquer erro de restrição.
--
-- Rode este arquivo no SQL editor do seu projeto Supabase.
-- ATENÇÃO: é IRREVERSÍVEL. Confirme que está no projeto certo antes de rodar.

begin;

delete from entradas;
delete from gastos;
delete from compras_parceladas;
delete from recorrencias;
delete from previsoes_mensais;
delete from economias_movimentos;
delete from fechamentos_mensais;

update economias_saldo_inicial
set valor = 0, atualizado_em = now()
where id = true;

commit;

-- Conferência rápida (deve retornar tudo 0, exceto categorias/cartoes/usuarios):
-- select
--   (select count(*) from entradas) as entradas,
--   (select count(*) from gastos) as gastos,
--   (select count(*) from compras_parceladas) as compras_parceladas,
--   (select count(*) from recorrencias) as recorrencias,
--   (select count(*) from previsoes_mensais) as previsoes_mensais,
--   (select count(*) from economias_movimentos) as economias_movimentos,
--   (select count(*) from fechamentos_mensais) as fechamentos_mensais,
--   (select valor from economias_saldo_inicial where id = true) as saldo_inicial_economias,
--   (select count(*) from categorias) as categorias,
--   (select count(*) from cartoes) as cartoes,
--   (select count(*) from usuarios) as usuarios;
