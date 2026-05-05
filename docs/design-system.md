# GreenLab Design System (mini)

Documenta as escolhas visuais do app pra manter consistência ao adicionar
novas telas/componentes.

## Marca

- **Nome:** GreenLab
- **Tagline:** Análise. Dados. Vantagem.
- **Logo:** `/public/greenlab-logo.png` (basquete + bar chart verde)
- **Tom:** sport analytics, premium SaaS, dark-first

## Cores

### Marca (verde)
Definidas em `tailwind.config.js` como `brand-{50..950}`:
- `brand-500` (#22c55e) — CTA, links ativos, indicadores live
- `brand-400` — texto/acento secundário
- `brand-300` — destaques sobre fundo escuro
- `brand-500/10` `brand-500/20` `brand-500/40` — fundos e bordas translúcidas

**Regra:** use `brand-*` para qualquer elemento de **branding/ação primária**.
Não usar mais `orange-*` para isso.

### Cores semânticas (não-marca)
| Uso | Cor Tailwind |
|---|---|
| Pontos (mercado) | `orange-*` |
| Assistências (mercado) | `sky-*` |
| Rebotes (mercado) | `violet-*` |
| Sucesso/em quadra | `emerald-*` |
| Atenção/foul trouble | `amber-*` / `red-*` |
| Inativo/erro | `red-*` |
| Neutro | `slate-*` |

### Camadas de superfície
- `bg-slate-900` (body) — base, quase preto
- `bg-slate-800/70` — cards (translúcido, dá profundidade)
- `bg-slate-800` — cards selecionados/elevados
- Borders: `border-slate-700/60` (sutil) ou `border-slate-700` (definido)

## Tipografia

- **Família:** `Inter` (Google Fonts) com fallback system
- **Tabular numerals:** classe `.tabular` em qualquer número que precise
  alinhar em colunas (placares, stats, projeções)
- **Tracking-tight:** títulos H1/H2 ganham `tracking-tight` pra parecer
  mais premium
- **Escala:**
  - `text-[10px]` — micro-pills, badges
  - `text-xs` (12px) — captions, status secundário
  - `text-sm` (14px) — corpo padrão
  - `text-base` (16px) — corpo destaque
  - `text-lg` (18px) — títulos de seção
  - `text-xl` / `text-2xl` — títulos de página

- **Pesos usados:** `font-medium` (500), `font-semibold` (600), `font-bold` (700)

## Sombras (definidas no Tailwind)

```js
shadow-soft   // 1-2px, sutil — botões, cards normais
shadow-raised // 4-12px, médio — modais, cards principais
shadow-glow   // brand verde — elementos selecionados
```

## Componentes utilitários (em `src/index.css`)

Use essas classes em vez de repetir Tailwind a cada uso:

| Classe | Quando usar |
|---|---|
| `.card` | Container elevado padrão (cards de dados, blocos de UI) |
| `.card-raised` | Blocos principais com mais ênfase (Terminal de Apostas etc.) |
| `.btn-primary` | CTA principal (verde marca) |
| `.btn-secondary` | Ações secundárias (slate) |
| `.pill` | Badges pequenos (10px uppercase) |
| `.skeleton` | Bloco shimmer pra loading states |
| `.page` | Container externo padronizado (`mx-auto px-4 sm:px-6 max-w-7xl`) |
| `.tabular` | Numerais tabulares em qualquer número |

## Microinterações

- **Transições:** `duration-150` (instantâneo) ou `duration-200` (suave)
- **Hover em cards:** `hover:-translate-y-0.5 hover:border-slate-500`
- **Active live indicator:** ponto pulsante `animate-pulse-subtle` cor brand
- **Fade in:** `animate-fade-in` em cards que aparecem dinamicamente
- **Skeleton shimmer:** `animate-shimmer` (já dentro de `.skeleton`)

## Estados padronizados

Em `src/components/States.tsx`:
- `<EmptyState icon="📭" title="..." description="..." />` — quando não há dados
- `<ErrorState ... onRetry={...} />` — erro bloqueante (centralizado)
- `<InlineError tone="amber|red" ... />` — banner de erro não-bloqueante

Em `src/components/Skeleton.tsx`:
- `<Skeleton className="h-4 w-32" />` — bloco genérico
- `<SkeletonText lines={3} />` — texto multilinha
- `<SkeletonGameCard />` / `<SkeletonGameGrid count={6} />`
- `<SkeletonPlayerRow />` / `<SkeletonList count={5} />`

## Responsivo

Breakpoints Tailwind padrão:
- `sm` 640px — celular largo
- `md` 768px — tablet vertical / desktop pequeno
- `lg` 1024px — desktop
- `xl` 1280px — desktop largo

**Regras gerais:**
- Mobile (`<sm`): 1 coluna, padding 16px, tipografia base
- Tablet (`sm-lg`): 2 colunas onde fizer sentido
- Desktop (`lg+`): 2-3 colunas, cards lado a lado

## Como ajustar a marca

Pra trocar a cor primária inteira do app, edite só `tailwind.config.js`:

```js
brand: {
  500: '#novo-hex',
  // ...resto da escala
}
```

Tudo no app que usa `brand-*` migra automaticamente.
