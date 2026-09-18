// Landing pública: traducciones y el mockup interactivo del tablero.
//
// Salió de landing.html para que script-src pueda prohibir el JavaScript inline.
// Sigue siendo un script clásico: esta página no carga el frontend de la app.

(function () {

// ---- Traducciones ----
const T = {
  es: {
    'page.title':        'FUN TasKing! — Gestión visual de tareas',
    'hero.h1':           'Organizá tu equipo,<br>sin complicaciones',
    'hero.p':            '<strong>FUN TasKing!</strong> es un tablero Kanban visual, multiusuario y de código abierto. Coordiná proyectos, seguí el avance y mantené a tu equipo sincronizado — todo desde el navegador.',
    'hero.cta':          '🚀 Entrar con Google',
    'mockup.h2':         'Así trabajan los equipos que usan <strong>FUN TasKing!</strong>',
    'mockup.hint':       '✋ ¡Arrastrá las tarjetas entre columnas — y festejá cuando algo llega a Terminado! 🎉',
    'col.pendiente':     'Pendiente',
    'col.progreso':      'En progreso',
    'col.revision':      'Revisión',
    'col.bloqueado':     'Bloqueado',
    'col.terminado':     '✅ Terminado',
    'card.bug':          '<span class="mini-chip" style="background:#F44336">Bug</span><br>Fix login en mobile',
    'card.redesign':     'Rediseñar hero de la app',
    'card.feature':      '<span class="mini-chip" style="background:#2196F3">Feature</span><br>Notificaciones push',
    'card.docs':         '<span class="mini-chip" style="background:#4CAF50">Docs</span><br>Actualizar README',
    'card.refactor':     'Refactor módulo auth',
    'card.ux':           '<span class="mini-chip" style="background:#9C27B0">UX</span><br>Dark mode toggle',
    'card.slack':        'Integración Slack<br><small>Esperando API key del cliente</small>',
    'card.landing':      'Landing page',
    'card.labels':       'Sistema de etiquetas',
    'card.oauth':        'OAuth con Google',
    'features.h2':       'Todo lo que necesitabas,<br>ya está en <strong>FUN TasKing!</strong>',
    'feat.kanban.title': 'Kanban visual',
    'feat.kanban.desc':  'Columnas Pendiente, En progreso, Revisión, Bloqueado y Terminado. Mové tarjetas con un clic.',
    'feat.multi.title':  'Multi-usuario',
    'feat.multi.desc':   'Tableros compartidos con tu equipo. Acceso controlado por email: vos decidís quién puede ver y editar.',
    'feat.labels.title': 'Etiquetas y filtros',
    'feat.labels.desc':  'Etiquetá tarjetas por tipo, prioridad o área. Filtrá para ver solo lo que importa en este momento.',
    'feat.attach.title': 'Adjuntos',
    'feat.attach.desc':  'Subí imágenes y archivos directo en las tarjetas. Almacenado de forma segura en Cloudflare R2.',
    'feat.search.title': 'Búsqueda instantánea',
    'feat.search.desc':  'Encontrá cualquier tarjeta en segundos. Filtro por texto, etiqueta y columna. Atajos de teclado incluidos.',
    'feat.auth.title':   'Acceso con Google',
    'feat.auth.desc':    'Login seguro con OAuth de Google. Sin contraseñas que recordar, sin formularios de registro. Solo tu cuenta Google.',
    'oss.p':             '<strong>FUN TasKing!</strong> es <strong>código abierto</strong>. Podés hostearlo vos mismo en Cloudflare Workers gratis, ver cómo está hecho y contribuir mejoras.',
    'cta.h2':            '¿Listo para empezar con <strong>FUN TasKing!</strong>?',
    'cta.p':             'Pedí acceso al administrador de tu equipo y en minutos estás dentro.',
    'cta.btn':           '🚀 Entrar con Google',
    'footer.terms':      'Términos',
  },
  en: {
    'page.title':        'FUN TasKing! — Visual task management',
    'hero.h1':           'Organize your team,<br>without the hassle',
    'hero.p':            '<strong>FUN TasKing!</strong> is a visual Kanban board, multi-user and open source. Coordinate projects, track progress and keep your team in sync — all from the browser.',
    'hero.cta':          '🚀 Sign in with Google',
    'mockup.h2':         'How teams work with <strong>FUN TasKing!</strong>',
    'mockup.hint':       '✋ Drag cards between columns — and celebrate when something reaches Done! 🎉',
    'col.pendiente':     'To Do',
    'col.progreso':      'In Progress',
    'col.revision':      'Review',
    'col.bloqueado':     'Blocked',
    'col.terminado':     '✅ Done',
    'card.bug':          '<span class="mini-chip" style="background:#F44336">Bug</span><br>Fix mobile login',
    'card.redesign':     'Redesign app hero',
    'card.feature':      '<span class="mini-chip" style="background:#2196F3">Feature</span><br>Push notifications',
    'card.docs':         '<span class="mini-chip" style="background:#4CAF50">Docs</span><br>Update README',
    'card.refactor':     'Refactor auth module',
    'card.ux':           '<span class="mini-chip" style="background:#9C27B0">UX</span><br>Dark mode toggle',
    'card.slack':        'Slack integration<br><small>Waiting for client API key</small>',
    'card.landing':      'Landing page',
    'card.labels':       'Labels system',
    'card.oauth':        'OAuth with Google',
    'features.h2':       'Everything you needed,<br>now in <strong>FUN TasKing!</strong>',
    'feat.kanban.title': 'Visual Kanban',
    'feat.kanban.desc':  'Columns for To Do, In Progress, Review, Blocked and Done. Move cards with a click.',
    'feat.multi.title':  'Multi-user',
    'feat.multi.desc':   'Shared boards with your team. Email-based access control: you decide who can view and edit.',
    'feat.labels.title': 'Labels & filters',
    'feat.labels.desc':  'Tag cards by type, priority or area. Filter to see only what matters right now.',
    'feat.attach.title': 'Attachments',
    'feat.attach.desc':  'Upload images and files directly to cards. Stored securely on Cloudflare R2.',
    'feat.search.title': 'Instant search',
    'feat.search.desc':  'Find any card in seconds. Filter by text, label and column. Keyboard shortcuts included.',
    'feat.auth.title':   'Google sign-in',
    'feat.auth.desc':    'Secure login with Google OAuth. No passwords to remember, no registration forms. Just your Google account.',
    'oss.p':             '<strong>FUN TasKing!</strong> is <strong>open source</strong>. You can self-host it on Cloudflare Workers for free, see how it\'s built and contribute improvements.',
    'cta.h2':            'Ready to get started with <strong>FUN TasKing!</strong>?',
    'cta.p':             'Ask your team admin for access and you\'ll be in within minutes.',
    'cta.btn':           '🚀 Sign in with Google',
    'footer.terms':      'Terms',
  },
  pt: {
    'page.title':        'FUN TasKing! — Gestão visual de tarefas',
    'hero.h1':           'Organize sua equipe,<br>sem complicações',
    'hero.p':            '<strong>FUN TasKing!</strong> é um quadro Kanban visual, multiusuário e de código aberto. Coordene projetos, acompanhe o progresso e mantenha sua equipe sincronizada — tudo pelo navegador.',
    'hero.cta':          '🚀 Entrar com Google',
    'mockup.h2':         'Como as equipes trabalham com <strong>FUN TasKing!</strong>',
    'mockup.hint':       '✋ Arraste os cartões entre colunas — e comemore quando algo chega em Concluído! 🎉',
    'col.pendiente':     'A fazer',
    'col.progreso':      'Em progresso',
    'col.revision':      'Revisão',
    'col.bloqueado':     'Bloqueado',
    'col.terminado':     '✅ Concluído',
    'card.bug':          '<span class="mini-chip" style="background:#F44336">Bug</span><br>Corrigir login no mobile',
    'card.redesign':     'Redesenhar hero do app',
    'card.feature':      '<span class="mini-chip" style="background:#2196F3">Feature</span><br>Notificações push',
    'card.docs':         '<span class="mini-chip" style="background:#4CAF50">Docs</span><br>Atualizar README',
    'card.refactor':     'Refatorar módulo auth',
    'card.ux':           '<span class="mini-chip" style="background:#9C27B0">UX</span><br>Toggle modo escuro',
    'card.slack':        'Integração Slack<br><small>Aguardando API key do cliente</small>',
    'card.landing':      'Página inicial',
    'card.labels':       'Sistema de etiquetas',
    'card.oauth':        'OAuth com Google',
    'features.h2':       'Tudo que você precisava,<br>já está no <strong>FUN TasKing!</strong>',
    'feat.kanban.title': 'Kanban visual',
    'feat.kanban.desc':  'Colunas A fazer, Em progresso, Revisão, Bloqueado e Concluído. Mova cartões com um clique.',
    'feat.multi.title':  'Multiusuário',
    'feat.multi.desc':   'Quadros compartilhados com sua equipe. Controle de acesso por e-mail: você decide quem pode ver e editar.',
    'feat.labels.title': 'Etiquetas e filtros',
    'feat.labels.desc':  'Etiquete cartões por tipo, prioridade ou área. Filtre para ver apenas o que importa agora.',
    'feat.attach.title': 'Anexos',
    'feat.attach.desc':  'Faça upload de imagens e arquivos direto nos cartões. Armazenado com segurança no Cloudflare R2.',
    'feat.search.title': 'Busca instantânea',
    'feat.search.desc':  'Encontre qualquer cartão em segundos. Filtro por texto, etiqueta e coluna. Atalhos de teclado incluídos.',
    'feat.auth.title':   'Acesso com Google',
    'feat.auth.desc':    'Login seguro com OAuth do Google. Sem senhas para lembrar, sem formulários de cadastro. Só sua conta Google.',
    'oss.p':             '<strong>FUN TasKing!</strong> é <strong>código aberto</strong>. Você pode hospedá-lo no Cloudflare Workers de graça, ver como foi feito e contribuir com melhorias.',
    'cta.h2':            'Pronto para começar com <strong>FUN TasKing!</strong>?',
    'cta.p':             'Peça acesso ao administrador da sua equipe e em minutos você estará dentro.',
    'cta.btn':           '🚀 Entrar com Google',
    'footer.terms':      'Termos',
  },
  zh: {
    'page.title':        'FUN TasKing! — 可视化任务管理',
    'hero.h1':           '让团队高效协作，<br>简单无负担',
    'hero.p':            '<strong>FUN TasKing!</strong> 是一款可视化看板工具，支持多用户、开源免费。协调项目进度，追踪任务状态，让团队始终保持同步 — 一切尽在浏览器中。',
    'hero.cta':          '🚀 使用 Google 登录',
    'mockup.h2':         '团队如何使用 <strong>FUN TasKing!</strong>',
    'mockup.hint':       '✋ 在列之间拖动卡片 — 完成时尽情庆祝！🎉',
    'col.pendiente':     '待办',
    'col.progreso':      '进行中',
    'col.revision':      '审核',
    'col.bloqueado':     '已阻塞',
    'col.terminado':     '✅ 已完成',
    'card.bug':          '<span class="mini-chip" style="background:#F44336">Bug</span><br>修复移动端登录',
    'card.redesign':     '重新设计应用首页',
    'card.feature':      '<span class="mini-chip" style="background:#2196F3">Feature</span><br>推送通知',
    'card.docs':         '<span class="mini-chip" style="background:#4CAF50">Docs</span><br>更新 README',
    'card.refactor':     '重构认证模块',
    'card.ux':           '<span class="mini-chip" style="background:#9C27B0">UX</span><br>深色模式切换',
    'card.slack':        'Slack 集成<br><small>等待客户 API 密钥</small>',
    'card.landing':      '落地页',
    'card.labels':       '标签系统',
    'card.oauth':        'Google OAuth',
    'features.h2':       '你需要的一切，<br>都在 <strong>FUN TasKing!</strong> 中',
    'feat.kanban.title': '可视化看板',
    'feat.kanban.desc':  '包含待办、进行中、审核、已阻塞和已完成列。一键移动卡片。',
    'feat.multi.title':  '多用户协作',
    'feat.multi.desc':   '与团队共享看板。基于邮箱的访问控制：由你决定谁可以查看和编辑。',
    'feat.labels.title': '标签与筛选',
    'feat.labels.desc':  '按类型、优先级或领域为卡片添加标签。筛选出当下最重要的内容。',
    'feat.attach.title': '附件',
    'feat.attach.desc':  '直接在卡片中上传图片和文件，安全存储于 Cloudflare R2。',
    'feat.search.title': '即时搜索',
    'feat.search.desc':  '秒级找到任意卡片。支持按文本、标签和列筛选，内置键盘快捷键。',
    'feat.auth.title':   'Google 登录',
    'feat.auth.desc':    '使用 Google OAuth 安全登录。无需记住密码，无需注册表单，只需你的 Google 账号。',
    'oss.p':             '<strong>FUN TasKing!</strong> 是<strong>开源</strong>项目。你可以免费在 Cloudflare Workers 上自托管，查看源码并贡献改进。',
    'cta.h2':            '准备好开始使用 <strong>FUN TasKing!</strong> 了吗？',
    'cta.p':             '向团队管理员申请访问权限，几分钟内即可加入。',
    'cta.btn':           '🚀 使用 Google 登录',
    'footer.terms':      '使用条款',
  },
  de: {
    'page.title':        'FUN TasKing! — Visuelle Aufgabenverwaltung',
    'hero.h1':           'Organisiere dein Team,<br>ganz ohne Komplikationen',
    'hero.p':            '<strong>FUN TasKing!</strong> ist ein visuelles Kanban-Board, mehrbenutzer-fähig und Open Source. Koordiniere Projekte, verfolge Fortschritte und halte dein Team synchron — alles im Browser.',
    'hero.cta':          '🚀 Mit Google anmelden',
    'mockup.h2':         'So arbeiten Teams mit <strong>FUN TasKing!</strong>',
    'mockup.hint':       '✋ Ziehe Karten zwischen Spalten — und feiere, wenn etwas Fertig erreicht! 🎉',
    'col.pendiente':     'Offen',
    'col.progreso':      'In Bearbeitung',
    'col.revision':      'Überprüfung',
    'col.bloqueado':     'Blockiert',
    'col.terminado':     '✅ Fertig',
    'card.bug':          '<span class="mini-chip" style="background:#F44336">Bug</span><br>Mobile-Login beheben',
    'card.redesign':     'App-Hero neu gestalten',
    'card.feature':      '<span class="mini-chip" style="background:#2196F3">Feature</span><br>Push-Benachrichtigungen',
    'card.docs':         '<span class="mini-chip" style="background:#4CAF50">Docs</span><br>README aktualisieren',
    'card.refactor':     'Auth-Modul refaktorieren',
    'card.ux':           '<span class="mini-chip" style="background:#9C27B0">UX</span><br>Dunkelmodus-Schalter',
    'card.slack':        'Slack-Integration<br><small>Warte auf API-Schlüssel des Kunden</small>',
    'card.landing':      'Landingpage',
    'card.labels':       'Etikettensystem',
    'card.oauth':        'OAuth mit Google',
    'features.h2':       'Alles, was du brauchtest,<br>jetzt in <strong>FUN TasKing!</strong>',
    'feat.kanban.title': 'Visuelles Kanban',
    'feat.kanban.desc':  'Spalten für Offen, In Bearbeitung, Überprüfung, Blockiert und Fertig. Karten per Klick verschieben.',
    'feat.multi.title':  'Mehrbenutzer',
    'feat.multi.desc':   'Gemeinsame Boards mit deinem Team. E-Mail-basierte Zugriffskontrolle: Du entscheidest, wer sehen und bearbeiten darf.',
    'feat.labels.title': 'Etiketten & Filter',
    'feat.labels.desc':  'Karten nach Typ, Priorität oder Bereich taggen. Filtern, um nur das Wichtige jetzt zu sehen.',
    'feat.attach.title': 'Anhänge',
    'feat.attach.desc':  'Bilder und Dateien direkt in Karten hochladen. Sicher auf Cloudflare R2 gespeichert.',
    'feat.search.title': 'Sofortsuche',
    'feat.search.desc':  'Jede Karte in Sekunden finden. Filter nach Text, Etikett und Spalte. Tastaturkürzel inklusive.',
    'feat.auth.title':   'Google-Anmeldung',
    'feat.auth.desc':    'Sicherer Login mit Google OAuth. Keine Passwörter merken, keine Registrierungsformulare. Nur dein Google-Konto.',
    'oss.p':             '<strong>FUN TasKing!</strong> ist <strong>Open Source</strong>. Du kannst es kostenlos auf Cloudflare Workers hosten, nachsehen wie es gebaut wurde und Verbesserungen beitragen.',
    'cta.h2':            'Bereit, mit <strong>FUN TasKing!</strong> loszulegen?',
    'cta.p':             'Bitte den Administrator deines Teams um Zugang — in wenigen Minuten bist du drin.',
    'cta.btn':           '🚀 Mit Google anmelden',
    'footer.terms':      'Nutzungsbedingungen',
  },
};

// ---- Detección y aplicación de idioma ----
function detectLang() {
  const saved = localStorage.getItem('tasking-lang');
  if (saved && T[saved]) return saved;
  const nav = (navigator.language || 'es').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('de')) return 'de';
  if (nav.startsWith('pt')) return 'pt';
  if (nav.startsWith('en')) return 'en';
  return 'es';
}

function applyLang(lang) {
  localStorage.setItem('tasking-lang', lang);
  document.documentElement.lang = lang;
  document.title = T[lang]['page.title'];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const val = T[lang][el.dataset.i18n];
    if (val !== undefined) el.innerHTML = val;
  });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.dataset.lang));
});

applyLang(detectLang());

// ---- Confetti (igual que el tablero real) ----
const canvas = document.getElementById('mini-confetti');
const ctx = canvas.getContext('2d');
const COLORS = ["#ffd700","#ff6b6b","#4ecdc4","#45b7d1","#96ceb4","#ff9ff3","#54a0ff","#5f27cd","#00d2d3","#ff9f43"];
let particles = [], rafId = null;

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();

function launchConfetti() {
  particles = Array.from({ length: 160 }, () => ({
    x: Math.random() * canvas.width, y: -10 - Math.random() * 40,
    r: 5 + Math.random() * 6,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    angle: Math.random() * Math.PI * 2, spin: (Math.random() - .5) * .3,
    vx: (Math.random() - .5) * 6, vy: 3 + Math.random() * 5,
    gravity: .18 + Math.random() * .1, life: 1,
    decay: .012 + Math.random() * .008,
    shape: Math.random() > .5 ? 'rect' : 'circle',
  }));
  if (rafId) cancelAnimationFrame(rafId);
  step();
}

function step() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.life > 0);
  for (const p of particles) {
    ctx.save(); ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
    ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    if (p.shape === 'rect') ctx.fillRect(-p.r/2, -p.r/4, p.r, p.r/2);
    else { ctx.beginPath(); ctx.arc(0, 0, p.r/2, 0, Math.PI*2); ctx.fill(); }
    ctx.restore();
    p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
    p.angle += p.spin; p.life -= p.decay;
  }
  if (particles.length) rafId = requestAnimationFrame(step);
}

function celebrateCard(card) {
  launchConfetti();
  card.classList.remove('celebrating');
  void card.offsetWidth;
  card.classList.add('celebrating');
  card.addEventListener('animationend', () => card.classList.remove('celebrating'), { once: true });
}

// ---- Drag & drop entre columnas ----
let dragging = null;

document.querySelectorAll('.mini-card').forEach(card => {
  card.setAttribute('draggable', 'true');
  card.addEventListener('dragstart', () => {
    dragging = card;
    setTimeout(() => card.classList.add('dragging'), 0);
  });
  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    dragging = null;
  });
});

document.querySelectorAll('.mini-col').forEach(col => {
  col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('drag-over'); });
  col.addEventListener('dragleave', e => { if (!col.contains(e.relatedTarget)) col.classList.remove('drag-over'); });
  col.addEventListener('drop', e => {
    e.preventDefault();
    col.classList.remove('drag-over');
    if (!dragging || col.contains(dragging)) return;
    col.querySelector('.mini-cards-area').appendChild(dragging);
    if (col.dataset.col === 'terminado') celebrateCard(dragging);
  });
});

})();
