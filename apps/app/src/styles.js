import { themeCss } from "./theme.js";

// La CSP de la app (style-src 'self') prohíbe estilos en línea: todo el aspecto vive aquí, con colores
// que sólo salen de las variables de theme.js. Los anchos de las barras de saldo son clases w0…w50.

const BASE = `
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.5 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:var(--accent-text)}a:hover{color:var(--accent-deep)}
:focus-visible{outline:3px solid var(--accent-line);outline-offset:2px}
.skip{position:absolute;left:8px;top:-60px;z-index:10;background:var(--surface);color:var(--accent-deep);padding:12px 16px;border-radius:12px;font-weight:700}.skip:focus{top:8px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
.topbar.narrow{max-width:760px}
.topbar{display:flex;align-items:center;gap:12px;max-width:1120px;margin:0 auto;padding:8px 16px 0;min-height:60px}
.brand{display:inline-flex;align-items:center;gap:10px;min-height:44px;color:var(--ink);text-decoration:none;font-weight:800;font-size:1.05rem}
.brand:hover{color:var(--ink)}.brand svg{display:block}
.shell{max-width:760px;margin:0 auto;padding:4px 16px 56px}.shell.wide{max-width:1120px}.shell.has-tabbar{padding-bottom:120px}
.eyebrow{color:var(--accent-text);font-size:.8rem;font-weight:800;letter-spacing:.09em;text-transform:uppercase;margin:20px 0 0}
h1{font-family:Georgia,"Times New Roman",serif;font-weight:700;font-size:clamp(2rem,7vw,3rem);line-height:1.08;letter-spacing:-.01em;margin:8px 0 14px;color:var(--ink)}
h2{font-family:Georgia,"Times New Roman",serif;font-size:1.4rem;line-height:1.2;margin:0 0 10px;color:var(--ink)}
h3{font-size:1rem;margin:0 0 6px;color:var(--ink)}
p{font-size:1rem;line-height:1.55;color:var(--ink-2);margin:0 0 12px}
.muted,small{color:var(--ink-3)}.muted{font-size:.9rem}
.card,.ledger-section{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:20px;margin-top:16px}
.ledger-section h2{margin-bottom:12px}
.notice{background:var(--ok-bg);border:1px solid var(--line);border-radius:14px;padding:14px;color:var(--accent-deep);font-size:.95rem;margin:12px 0}
.notice[role=alert]{background:var(--coral-soft);border-color:transparent;color:var(--coral-text)}
.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;background:var(--accent-bg);color:var(--on-accent);border:1.5px solid transparent;border-radius:999px;padding:0 22px;text-decoration:none;font:inherit;font-weight:700;margin-top:14px;cursor:pointer}
.button:hover{color:var(--on-accent);filter:brightness(1.08)}
.button.secondary{background:transparent;color:var(--accent-text);border-color:var(--accent-line)}
.button.secondary:hover{background:var(--accent-soft);color:var(--accent-deep);filter:none}
.button.danger{background:transparent;color:var(--neg);border-color:var(--neg)}
.button.danger:hover{background:var(--coral-soft);color:var(--coral-text);filter:none}
.button[disabled],.button[aria-disabled=true]{opacity:.55;cursor:not-allowed}
.label{font-weight:700;display:block;margin:18px 0 6px;color:var(--ink)}
input,select,textarea{width:100%;min-height:48px;padding:12px 14px;border:1.5px solid var(--field);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;font-size:1rem}
textarea{min-height:88px}
input::placeholder,textarea::placeholder{color:var(--ink-3);opacity:1}
input[type=file]{padding:10px}
input[type=checkbox],input[type=radio]{width:auto;min-height:0}
.person{border-top:1px solid var(--line-soft);padding:14px 0}.person:first-of-type{border-top:0}
.person-row{display:flex;align-items:center;gap:12px;padding:14px 0;border-top:1px solid var(--line-soft)}
.person-row:first-child{border-top:0}.person-row>.grow{flex:1;min-width:0}.person-row strong{display:block;overflow-wrap:anywhere}
.person-row .row-actions{display:flex;gap:8px;flex-wrap:wrap}.person-row .row-actions .button{margin-top:6px}
.person-row form{margin:0}
.person-block{padding:14px 0;border-top:1px solid var(--line-soft)}.person-block:first-child{border-top:0}
.person-block .person-row{padding:0;border:0}.person-block .row-actions{margin:8px 0 0 56px;display:flex;gap:8px;flex-wrap:wrap}.person-block .row-actions form{margin:0}.person-block .row-actions .button{margin-top:0}
.avatar{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:.85rem;flex:none;background:var(--accent-soft);color:var(--accent-deep)}
.av1{background:var(--coral-soft);color:var(--coral-text)}.av2{background:var(--yel-soft);color:var(--yel-text)}.av3{background:var(--teal-soft);color:var(--teal-text)}
.noacct{background:var(--teal-soft);color:var(--teal-text);border:1.5px dashed var(--teal-line)}
.chip{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 10px;font-size:.8rem;font-weight:700;background:var(--chip);color:var(--ink-2);white-space:nowrap}
.chip.ok{background:var(--accent-soft);color:var(--accent-deep)}.chip.imp{background:var(--yel-soft);color:var(--yel-text)}.chip.warn{background:var(--warn-bg);color:var(--yel-text);border:1px solid var(--warn-line)}.chip.void{background:var(--chip);color:var(--ink-2)}
.chip.match{background:var(--chip);color:var(--ink-2)}
.chip.cat{background:var(--accent-soft);color:var(--accent-deep);white-space:normal;overflow-wrap:anywhere;max-width:100%;min-width:0}.chip.cat svg{width:14px;height:14px;flex:none}.chip.cat.none{background:transparent;color:var(--ink-3);border:1px dashed var(--line-strong)}.entry-category{margin:4px 0 0;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.money{font-variant-numeric:tabular-nums;white-space:nowrap}.owes{color:var(--neg)}.owed{color:var(--accent-text)}
table{border-collapse:collapse}.balance-table{width:100%;text-align:left}.balance-table th{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
.balance-table th,.balance-table td{padding:12px 8px;border-bottom:1px solid var(--line-soft)}.balance-table th:last-child,.balance-table td:last-child{text-align:right}
.balance-table tfoot td{font-weight:800;border-top:2px solid var(--line-mid);border-bottom:0}
.table-scroll{overflow-x:auto}.table-scroll .balance-table.wide{min-width:650px}
.section-top,.form-actions,.quick-actions,.export-actions{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.section-top .eyebrow{margin:0}.section-top .button{margin:0}.section-top h2{margin:0}
.quick-actions{justify-content:flex-start;margin-top:14px}.quick-actions .lead{font-size:.9rem;color:var(--ink-3);font-weight:600}
.quick-actions a,.export-actions a{display:inline-flex;align-items:center;min-height:44px;padding:0 16px;border:1.5px solid var(--line-strong);border-radius:999px;color:var(--accent-text);font-weight:700;text-decoration:none;background:var(--surface)}
.quick-actions a:hover,.export-actions a:hover{background:var(--accent-soft);color:var(--accent-deep)}
.form-actions{justify-content:flex-start}.form-actions .button{margin:0}
`;

const BOOK = `
.book-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:4px}
.book-head>div{min-width:0;max-width:100%}.book-head h1{margin-bottom:4px;overflow-wrap:anywhere}.book-head .actions{display:flex;gap:8px;flex-wrap:wrap}.book-head .actions .button{margin:0}
.book-grid{display:grid;gap:16px;align-items:start}
.book-grid>section,.book-grid .panel>section{margin-top:16px}.panel{min-width:0}.panel>.card:first-child,.panel>.ledger-section:first-child{margin-top:16px}
.currency-block+.currency-block{margin-top:24px}
.hero{background:var(--accent-bg);color:var(--on-accent);border-radius:22px;padding:16px 18px}
.hero.neg{background:var(--hero-neg)}.hero p{margin:0;color:var(--on-accent-2)}
.hero .hero-label{font-size:.8rem;font-weight:600}.hero .hero-amount{color:var(--on-accent);font-size:clamp(1.7rem,7vw,2.2rem);font-weight:800;letter-spacing:-.02em;line-height:1.2;margin:2px 0 4px}
.hero .hero-note{font-size:.95rem}
.hero a.why{display:inline-flex;align-items:center;min-height:44px;margin-top:6px;padding:0 16px;border:1.5px solid var(--on-accent-2);border-radius:999px;color:var(--on-accent);text-decoration:none;font-weight:700}.hero a.why:hover{background:rgba(255,253,248,.14);color:var(--on-accent)}
.balance-row .who a{color:inherit;text-decoration:none}.balance-row .who a:hover{text-decoration:underline}
.suggest-row>div{min-width:0;overflow-wrap:anywhere}.suggest-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 0;border-top:1px solid var(--line-soft)}.suggest-row:first-child{border-top:0}.suggest-row strong{display:block}.suggest-row .button{margin:0;flex:none}
.imported-group summary{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:start;padding:14px 0;cursor:pointer;list-style:none}.imported-group summary::-webkit-details-marker{display:none}.imported-group .entry-list{margin-left:8px;border-left:2px solid var(--line-soft);padding-left:8px}
.archive-tool{margin-top:20px;border-top:1px solid var(--line-soft);padding-top:12px}.archive-tool summary{cursor:pointer;min-height:44px;display:flex;align-items:center;font-weight:700;color:var(--neg)}
.group-card{background:var(--surface);border:1px solid var(--line);border-radius:22px;padding:6px 18px 6px;margin-top:12px}
.group-card .head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:14px 0 6px}.group-card .head h3{margin:0;font-size:1.05rem}
.sum-zero{font-size:.85rem;font-weight:700;color:var(--accent-text)}
.balance-list{list-style:none;margin:0;padding:0}.balance-row{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--line-soft)}
.balance-row:first-child{border-top:0}.balance-row .who{min-width:0;overflow-wrap:anywhere}.balance-row .who strong{font-weight:700;color:var(--ink)}.balance-row .who .tag{color:var(--ink-3);font-weight:500}
.balance-row .amount{display:flex;flex-direction:column-reverse;align-items:flex-end;text-align:right;font-weight:800}.balance-row .amount .word{font-size:.75rem;font-weight:600}.balance-row .amount.owed .word,.balance-row .amount.owes .word{color:var(--ink-3)}.balance-row .amount:not(.owed):not(.owes){color:var(--ink)}
.bar{position:relative;height:8px;border-radius:999px;background:var(--chip);margin-top:8px}.bar::after{content:"";position:absolute;left:50%;top:-2px;width:2px;height:12px;background:var(--field);border-radius:1px}
.bar .fill{position:absolute;top:0;height:8px;border-radius:999px}.bar .pos{left:50%;background:var(--accent-bg)}.bar .neg{right:50%;background:var(--bar-neg)}
.entry-list{list-style:none;padding:0;margin:0}.entry-row{border-top:1px solid var(--line-soft)}.entry-row:first-child{border-top:0}
.entry-row a{display:grid;grid-template-columns:44px 1fr auto;gap:12px;align-items:start;padding:14px 0;color:inherit;text-decoration:none;min-height:44px}
.entry-row a:hover .entry-title{text-decoration:underline}
.entry-main{min-width:0}.entry-title{display:block;color:var(--ink);overflow-wrap:anywhere}.entry-main small{display:block;color:var(--ink-3);margin-top:2px;font-size:.88rem}
.entry-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.entry-side{text-align:right}.entry-side .money{display:block;font-size:1.05rem;color:var(--ink)}.entry-side .money.owed,.imported-group .entry-side .money.owed{color:var(--accent-text)}.entry-side .money.owes{color:var(--neg)}.entry-side small{display:block;margin-top:2px;font-size:.82rem;font-weight:700}
.entry-voided .entry-title,.entry-voided .entry-side .money{text-decoration:line-through;color:var(--ink-3)}.entry-voided{opacity:.9}
.ico{width:44px;height:44px;border-radius:12px;display:grid;place-items:center;background:var(--chip);color:var(--ink-2)}.ico svg{display:block}
.ico-expense{background:var(--coral-soft);color:var(--coral-text)}.ico-income{background:var(--accent-soft);color:var(--accent-deep)}.ico-transfer{background:var(--teal-soft);color:var(--teal-text)}.ico-imported{background:var(--yel-soft);color:var(--yel-text)}
.more{width:100%;margin-top:12px}
.list-meta{font-size:.9rem;color:var(--ink-3);margin:0 0 4px}
.search-form{display:grid;grid-template-columns:1fr auto;gap:8px;margin:12px 0 8px;align-items:center}.search-form .button{margin:0}.search-form .clear{grid-column:1/-1;font-size:.9rem}.search-form select{grid-column:1/-1;min-height:44px}
.start-options{display:grid;gap:12px;margin-top:8px}.start-option{border:1.5px solid var(--line-strong);border-radius:18px;padding:16px;background:var(--surface)}.start-option h3{font-size:1.05rem;margin:0 0 4px}.start-option p{margin:0 0 6px;font-size:.95rem}.start-option .button{margin-top:6px}
.empty{text-align:center;padding:24px 8px}.empty p{margin-bottom:8px}.empty h3{font-family:Georgia,serif;font-size:1.25rem}
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:5;background:var(--surface);border-top:1px solid var(--line);display:grid;grid-template-columns:repeat(5,1fr);align-items:end;padding:6px 4px calc(8px + env(safe-area-inset-bottom))}
.tabbar a{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:48px;color:var(--ink-2);text-decoration:none;font-size:.75rem;font-weight:700;border-radius:12px}
.tabbar a:hover{color:var(--accent-deep);background:var(--accent-soft)}.tabbar svg{display:block}
.tabbar .fab{width:56px;height:56px;margin:-24px auto 0;border-radius:50%;background:var(--accent-bg);color:var(--on-accent);box-shadow:0 4px 14px var(--shadow);border:4px solid var(--surface);min-height:56px}
.tabbar .fab:hover{background:var(--accent-bg);color:var(--on-accent);filter:brightness(1.1)}
@media(min-width:900px){
.shell.has-tabbar{padding-bottom:56px}.tabbar{display:none}
.book-grid{grid-template-columns:minmax(320px,400px) minmax(0,1fr);gap:24px}
.book-wide{grid-column:1/-1}
}
`;

const FORMS = `
.ledger-form{display:grid;gap:18px;margin-top:20px}.ledger-form label{display:grid;gap:7px;font-weight:700;color:var(--ink)}
.ledger-form fieldset{border:1px solid var(--line);border-radius:16px;padding:14px 16px;margin:0;min-width:0}.ledger-form legend{font-weight:800;padding:0 6px;color:var(--ink)}
.form-grid,.share-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.ledger-form .form-grid.three{grid-template-columns:2fr 1fr 1fr}
.ledger-form .check-row{display:flex;align-items:center;gap:10px;margin:8px 0;font-weight:500;min-height:44px}.ledger-form .check-row input{flex:none}
.ledger-form input[type=file]{font:inherit}
.choices{display:flex;flex-wrap:wrap;gap:8px}
.choice{position:relative;display:inline-flex!important;font-weight:600!important;max-width:100%;min-width:0}
.choice input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.choice span{display:inline-flex;align-items:center;gap:6px;min-height:44px;min-width:0;max-width:100%;overflow-wrap:anywhere;padding:0 16px;border-radius:999px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink)}
.choice input:checked+span{background:var(--accent-soft);border-color:var(--accent-line);color:var(--accent-deep);font-weight:700}
.choice input:checked+span::before{content:"✓"}
.choice input:focus-visible+span{outline:3px solid var(--accent-line);outline-offset:2px}
.type-tabs{display:flex;gap:4px;background:var(--chip);padding:4px;border-radius:14px;margin-top:12px}
.type-tabs a{flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:6px;min-height:44px;border-radius:11px;color:var(--ink-2);text-decoration:none;font-weight:600;font-size:.95rem;padding:0 6px;text-align:center}
.type-tabs a[aria-current=page]{background:var(--surface);color:var(--ink);font-weight:700;box-shadow:0 1px 3px var(--shadow)}
.method-fields,.method-hint{display:none}.ledger-form:has(input[name=splitMethod][value=exact]:checked) .method-exact{display:grid}.ledger-form:has(input[name=splitMethod][value=percent]:checked) .method-percent{display:grid}.ledger-form:has(input[name=splitMethod][value=shares]:checked) .method-shares{display:grid}.ledger-form:has(input[name=splitMethod][value=fixed]:checked) .method-fixed{display:grid}.ledger-form:has(input[name=splitMethod][value=equal]:checked) p.method-equal{display:block}.ledger-form:has(input[name=splitMethod][value=exact]:checked) p.method-exact{display:block}.ledger-form:has(input[name=splitMethod][value=percent]:checked) p.method-percent{display:block}.ledger-form:has(input[name=splitMethod][value=shares]:checked) p.method-shares{display:block}.ledger-form:has(input[name=splitMethod][value=fixed]:checked) p.method-fixed{display:block}@supports not selector(:has(*)){.method-fields{display:grid}.method-hint{display:block}}
.method-fields{margin-top:12px}.unit{color:var(--ink-3);font-weight:500}.all-to{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:12px}.all-to[hidden]{display:none}.all-to .lead{font-size:.9rem;color:var(--ink-3);font-weight:600}
.chip-button{min-height:44px;padding:0 16px;border-radius:999px;border:1.5px solid var(--line-strong);background:var(--surface);color:var(--ink);font:inherit;font-weight:600;cursor:pointer}.chip-button:hover{background:var(--accent-soft);color:var(--accent-deep)}
.amount-input{font-size:1.6rem;font-weight:800;min-height:60px;font-variant-numeric:tabular-nums}
.hint{font-size:.9rem;color:var(--ink-3);font-weight:400}
.form-feedback{margin:0;color:var(--ink-2)}.form-feedback.error{color:var(--neg);font-weight:700}
.effect-preview{border:1px solid var(--line);border-radius:16px;padding:14px 16px;background:var(--sunken)}.effect-preview[hidden]{display:none}.effect-preview h3{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-3);margin:0 0 6px}.effect-preview ul{list-style:none;margin:0;padding:0}.effect-preview li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-top:1px solid var(--line-soft)}.effect-preview li:first-child{border-top:0}.preview-note{margin:8px 0 0}.preview-note.warn{color:var(--neg);font-weight:600}.pending-entry{border:1px dashed var(--field);border-radius:12px;padding:12px;color:var(--ink-2)}
.sticky-actions{position:sticky;bottom:0;background:var(--bg);padding:12px 0 8px;border-top:1px solid var(--line)}
.incident-row{display:grid;grid-template-columns:auto 1fr minmax(170px,230px);gap:10px;align-items:center;padding:12px 0;border-bottom:1px solid var(--line-soft)}.incident-row span{min-width:0;overflow-wrap:anywhere}
.incident-row strong{display:inline-flex;background:var(--yel-soft);color:var(--yel-text);border-radius:999px;padding:3px 10px;font-size:.85rem}
.steps{list-style:none;display:flex;flex-wrap:wrap;gap:8px 16px;padding:0;margin:14px 0 18px;font-size:.9rem;font-weight:600;color:var(--ink-3)}
.steps li{display:flex;align-items:center;gap:6px}.steps .n{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;border:1.5px solid var(--line-strong);font-size:.8rem}
.steps li.done{color:var(--accent-text)}.steps li.done .n{background:var(--accent-bg);border-color:var(--accent-bg);color:var(--on-accent)}
.steps li[aria-current=step]{color:var(--ink);font-weight:800}.steps li[aria-current=step] .n{border-color:var(--accent-line);color:var(--accent-deep)}
.lead-count{font-size:1.05rem;color:var(--ink-1)}
.entry-amount{font-family:Georgia,serif;font-size:clamp(2rem,9vw,3rem);font-weight:700;color:var(--ink);margin:0 0 6px}
.badges{display:flex;gap:8px;flex-wrap:wrap;margin-top:16px}
.back-link{display:inline-flex;align-items:center;min-height:44px;font-weight:700;text-decoration:none}
.timeline{list-style:none;margin:0;padding:0}.timeline li{position:relative;padding:0 0 16px 28px}.timeline li::before{content:"";position:absolute;left:4px;top:6px;width:12px;height:12px;border-radius:50%;background:var(--line-strong)}
.timeline li:first-child::before{background:var(--accent-bg);box-shadow:0 0 0 4px var(--accent-soft)}.timeline li:not(:last-child)::after{content:"";position:absolute;left:9px;top:20px;bottom:0;width:2px;background:var(--line-soft)}
.detail-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:16px}.detail-actions .button{flex:1;margin:0}
.footnote{font-size:.9rem;color:var(--ink-3)}
.split-total td{font-weight:800}
@media(max-width:560px){
.balance-table.split th,.balance-table.split td{padding:10px 2px;font-size:.78rem}.balance-table.split th{letter-spacing:0;font-size:.66rem}.balance-table.split td:first-child{max-width:4.5rem;overflow-wrap:anywhere}.card,.ledger-section{padding:16px}
.form-grid,.share-grid,.ledger-form .form-grid.three{grid-template-columns:1fr}.ledger-form .form-grid.amount-row{grid-template-columns:minmax(0,1fr) 150px}
.balance-table th,.balance-table td{padding:10px 4px;font-size:.88rem}.incident-row{grid-template-columns:1fr}
.section-top{align-items:flex-start}.book-head .actions{width:100%}.book-head .actions .button{flex:1}
.entry-row a{grid-template-columns:44px 1fr}.entry-side{grid-column:2;text-align:left;display:flex;gap:10px;flex-wrap:wrap;align-items:baseline}.entry-side .money,.entry-side small{display:inline}
}
.category-field select,.category-field input{width:100%}.category-field .category-hint{min-height:1.2em;margin:4px 0 0}
.cat-group{margin-top:16px}.cat-group h3{margin:0 0 8px;font-size:1rem}.cat-row{display:grid;gap:8px;padding:12px 0;border-top:1px solid var(--line-soft)}.cat-row:first-of-type{border-top:0}
.cat-row .cat-head{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.cat-row .cat-head .count{margin-left:auto;font-size:.85rem;color:var(--ink-3)}
.cat-row form{display:grid;gap:8px;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));align-items:end;margin:0}.cat-row form .button{margin:0}
.cat-row details>summary{min-height:44px;display:flex;align-items:center;cursor:pointer;font-weight:700;color:var(--accent-text)}
.cat-row input,.cat-row select{width:100%;min-height:44px}
@media(max-width:360px){.type-tabs a{font-size:.85rem;gap:3px}.type-tabs a svg{display:none}}
.button.big{min-height:60px;font-size:1.15rem;padding:0 32px;margin-top:18px}.first-run{text-align:center;padding:24px 8px}.first-run .button.big{display:flex;max-width:420px;margin-left:auto;margin-right:auto}.first-run-import{margin-top:18px;color:var(--ink-2)}
.start-choice{display:grid;gap:8px;margin:12px 0}.start-choice .choice input:disabled+span{color:var(--ink-3)}
.entry-row.selectable{display:flex;gap:4px;align-items:flex-start}.entry-row.selectable>a{flex:1;min-width:0}.select-box{display:grid;place-items:center;min-width:44px;min-height:44px;cursor:pointer}.select-box input{width:22px;height:22px;accent-color:var(--accent-bg)}
.selection-bar{border:1.5px solid var(--line-strong);border-radius:16px;padding:12px 14px;margin:12px 0;background:var(--surface)}.selection-bar h3{margin:0 0 4px;font-size:1rem}.selection-controls{display:grid;gap:10px;align-items:end}.selection-controls select{width:100%;min-height:44px}.selection-controls .button{margin:0}.selection-count{margin:4px 0 0;min-height:1.2em;font-weight:700}
.notice form.inline-form{display:inline;margin-left:12px}.notice .button{margin:0;min-height:44px}
.classify-card{border:1.5px solid var(--line-strong);border-radius:20px;padding:18px;background:var(--surface);margin-top:12px}.classify-card h2{margin:0 0 4px;overflow-wrap:anywhere}.suggestion{border:1.5px dashed var(--accent-line);border-radius:14px;padding:12px;margin:12px 0}.suggestion p{margin:0 0 6px}.suggestion .button{margin:6px 0 0}
.recents .chips{display:flex;gap:8px;flex-wrap:wrap}.chip-button kbd,.button kbd{font:inherit;font-size:.78rem;border:1px solid currentColor;border-radius:6px;padding:0 6px;margin-left:6px;opacity:.85}
.all-categories{display:grid;gap:8px;margin-top:14px}.all-categories select{width:100%;min-height:44px}.all-categories .button{margin:0}.classify-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}.classify-actions form{margin:0}.classify-actions .button{margin:0}
.person-filters{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0}.person-filters .chip-button{display:inline-flex;align-items:center;text-decoration:none}.person-filters .chip-button.active{background:var(--accent-bg);color:var(--on-accent);border-color:transparent}
.recent-strip{border:1.5px solid var(--accent-line);background:var(--accent-soft);border-radius:16px;padding:8px 14px;margin:0 0 14px}.recent-strip h3{margin:6px 0 0;font-size:.95rem;color:var(--accent-deep)}.recent-strip .entry-list .entry-row{border-top:0}
`;

export function appCss() {
  const widths = Array.from({ length: 51 }, (_, i) => `.w${i}{width:${i}%}`).join("");
  return `${themeCss()}${BASE}${BOOK}${FORMS}${widths}`;
}

