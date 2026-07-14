# App de finanças pessoais — especificação para desenvolvimento

## Contexto
App de uso pessoal, para duas pessoas (casal), inspirado na estrutura de navegação e lógica visual de um app de mercado (referência: prints em anexo), mas com a lógica de cálculo corrigida e categorias interligadas. Sem intenção comercial.

## Público e acesso
- 2 usuários (login simples), dados compartilhados entre os dois em tempo real
- Acesso via celular, como PWA instalável (não precisa loja de apps)

## Arquitetura recomendada
- **Frontend**: React (Vite), PWA instalável, visual mobile-first
- **Backend/dados**: Supabase (Postgres gerenciado, autenticação pronta, sincronização entre os dois usuários)
- **Design**: a definir no Figma pela Cynthia; por ora, seguir estrutura de navegação e código de cores do app de referência (verde → amarelo → vermelho conforme saldo)

## Modelo de dados (visão geral)
- `usuarios` — os 2 usuários da casa
- `categorias` — ex: Mercado, Delivery, Uber, Lazer, Compras casa, Saúde
- `previsoes_mensais` — valor previsto por categoria, por mês
- `gastos` — lançamentos reais: valor, categoria, data, usuário, tag, meio de pagamento (dinheiro/cartão)
- `compras_parceladas` — valor total, número de parcelas, categoria, data da compra (cada parcela lançada referencia essa compra e sabe sua posição, ex: 3/4)
- `entradas` — receitas do mês

O "orçamento diário" **não é armazenado** — é sempre calculado a partir de previsão, gastos já feitos e dias restantes (ver lógica abaixo).

## Lógica central de cálculo (o núcleo do app)

Para cada categoria, a cada dia:
```
restante_categoria = previsto_categoria - soma_gastos_categoria_no_mes
dias_restantes = dias_do_mes - dia_atual + 1
valor_diario_categoria = restante_categoria / dias_restantes
```

O "diário" mostrado na home = **soma dos `valor_diario_categoria` de todas as categorias**, não um número fixo único.

Cada novo lançamento de gasto recalcula automaticamente o valor diário da categoria correspondente para os dias restantes — sem precisar de ação manual.

### Problema que isso resolve (vs. app de referência)
No app de referência, o "diário" é fixo (previsão total ÷ dias do mês), calculado uma vez e nunca mais ajustado por categoria. Isso gera duas situações erradas observadas no uso: gastar todo o previsto de uma categoria de uma vez e o app continuar "oferecendo" aquele valor nos dias seguintes; ou gastar o diário normalmente e, ao ir a uma categoria específica depois, descobrir que já tinha estourado sem aviso.

## Tela de categoria (nova, não existe no app de referência)
Para cada categoria, mostrar:
```
Mercado
Previsto: R$ 2.000
Gasto até hoje: R$ 500
Para gastar: R$ 1.500 (20 dias restantes → R$ 75/dia)
```

## Compras parceladas
Diferente de "repetir o mesmo valor por X meses" (como no app de referência). Deve ser uma entidade própria:
- Registro único: valor total, número de parcelas, categoria, data da compra
- Cada parcela lançada automaticamente no mês correspondente, sabendo sua posição (ex: "parcela 3/4")
- Cada parcela desconta do previsto da categoria daquele mês, como um gasto normal
- Visão de saldo devedor (quanto falta pagar daquela compra)

## Telas (estrutura baseada no app de referência)
1. **Saldos** — lista de dias do mês, filtro por tipo (entradas/saídas/diário/cartão/todas), saldo acumulado colorido (verde/amarelo/vermelho)
2. **Categorias** (substitui/complementa "tags" do app de referência) — cada categoria com previsto/gasto/resta/dia
3. **Totais** — resumo do mês: performance, % economizado, custo de vida, diário médio
4. **Lançamento** — valor, tipo (entrada/saída/parcelado), categoria, data, recorrência
5. **Previsão mensal** — definir valor previsto por categoria no início do mês

## Backlog de funcionalidades desejadas (priorizado)
1. Orçamento diário dinâmico por categoria (não fixo) — **crítico**
2. Tela de categoria com previsto/gasto/resta/por dia — **crítico**
3. Compras parceladas como entidade própria, com parcela X/Y visível — **crítico**
4. Dois usuários, dados compartilhados em tempo real
5. Visual verde/amarelo/vermelho por saldo, estilo do app de referência
6. (Futuro) Relatórios/gráficos históricos, notificações, múltiplos cartões

## Design
Visual final será desenhado no Figma por Cynthia. Para o MVP inicial, seguir estrutura de navegação e comportamento visual do app de referência (cores de saldo, layout de lista por dia) para não travar o início do desenvolvimento.
