# Visão Executiva de Estoque — Âmbar Energia

Dashboard executivo de estoque e inventários, reescrito em **React + Vite + Supabase + Plotly**.

## Como rodar no StackBlitz

1. Importe a pasta do projeto no [StackBlitz](https://stackblitz.com) (ou use "Import from GitHub" se subir para um repositório).
2. Abra o painel **Secrets** (ícone de cadeado) e adicione:
   - `VITE_SUPABASE_URL` → URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` → chave **anon/public** (nunca use a service_role)
3. O StackBlitz instala as dependências automaticamente.
4. Clique em **Run** / aguarde o `npm install` e o dev server.

## Como rodar localmente

```bash
cp .env.example .env.local
# edite .env.local com suas credenciais

npm install
npm run dev
```

## Funcionalidades

### Aba Visão Geral
- Evolução temporal do estoque (Total / Crítico / Obsoleto / Obra) com legenda interativa
- Clique no gráfico para fixar período
- Cards financeiros e operacionais com tendência MoM
- Giro de estoque e cobertura (mensal / anual)
- Ranking de estoque por unidade
- Composição do estoque (rosca)
- Rankings por categoria (Crítico / Obsoleto / Obra)
- Evolução Compra × Consumo
- Compra × Consumo e SKUs por unidade
- Evolução temporal de SKUs
- Giro × Cobertura (eixo duplo)
- Materiais parados > 3 meses + export Excel

### Aba Painel de Inventários
- Filtros: Empresa / Ano / Mês / Tipo
- Tabela executiva de 3 andares (volume, quantidades, valores + acurácia)
- Gerenciamento de inventários ativos por unidade (marcar/desmarcar)
- Separação Geral × Rotativo

## Observações de performance

A base original pode ter centenas de milhares de linhas. O loader busca em lotes de 1.000 com retry.  
Para produção em escala, recomenda-se:

1. Criar **views materializadas** ou funções RPC no Supabase com agregações mensais.
2. Ou usar **Edge Functions** para os cálculos pesados (giro, itens parados).
3. Aplicar RLS e índices nas colunas de filtro (`ano_referencia`, `mes_referencia`, `unidade_almoxarifado`).

## Stack

- React 18 + Vite 5
- Tailwind CSS 3
- Supabase JS v2
- Plotly.js (via react-plotly.js)
- xlsx (export Excel)
- Lucide (ícones — disponível se quiser expandir)

## Licença

Uso interno Âmbar Energia.
