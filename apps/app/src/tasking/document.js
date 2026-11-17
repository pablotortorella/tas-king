// Documento de TasKing conservado, adaptado al namespace y a la CSP de HomeSuite.
import { legalLinks } from "../legal.js";

export const TASKING_DOCUMENT = `<!DOCTYPE html>
<html data-tasking-integrated="true" lang="es">
<head><link rel="apple-touch-icon" sizes="180x180" href="/icons/homesuite-apple-touch-180.v1.png"><link rel="manifest" href="/manifest.webmanifest"><script src="/pwa.js" defer></script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>FUN TasKing!</title>
<link rel="icon" type="image/svg+xml" href="/tareas/favicon.v1.svg">
<script src="/tareas/js/theme-boot.js"></script>
<link rel="stylesheet" href="/tareas/css/app.css">
<link rel="stylesheet" href="/tareas/css/static.css"><script src="/tareas/js/integrated-boot.js" defer></script><link rel="stylesheet" href="/tareas/css/runtime.css" data-tasking-runtime></head>
<body class="tasking-app">
<canvas id="confetti-canvas"></canvas>
<div id="globalTip"></div>
<header>
  <div class="header-top">
    <div class="header-left"><a class="tasking-home" href="/" title="Volver al inicio de HomeSuite">HomeSuite</a>
      <span class="logo">👑</span>
      <span class="brand">FUN TasKing!</span>
      <select id="boardSelect" class="board-select" title="Cambiar de tablero"></select>
      <button id="editBoardBtn" title="Renombrar este tablero">✏️</button>
      <button id="membersBtn" title="Miembros y configuración del tablero">⚙️</button>
      <button id="newBoardBtn" title="Nuevo tablero">＋</button>
    </div>
    <span class="user"><button id="wipPulseBtn" class="theme-btn" title="Pulso de tareas en progreso — clic para activar/desactivar" aria-label="Activar o desactivar el pulso de tareas en progreso">🎯</button><button id="themeBtn" class="theme-btn" title="Cambiar tema claro/oscuro" aria-label="Cambiar tema">🌙</button><button class="me" id="profileBtn" title="Editar mi perfil"></button><button id="adminBtn" title="Administración" data-tasking-style="tasking-static-1" data-tasking-display="none">⚙ Admin<span id="adminBadge" data-tasking-style="tasking-static-2" data-tasking-display="none"></span></button><a href="/tareas/salir" title="Cerrar sesión">Salir</a></span>
  </div>
  <div class="actions">
    <button id="goalsBtn" title="Objetivos: ver, editar y resaltar tarjetas">🎯 Objetivos</button>
    <button id="metricsBtn" title="¿Cómo vamos?">📊 ¿Cómo vamos?</button>
    <input type="search" id="searchInput" placeholder="🔍 Buscar tarjetas...">
    <select id="assigneeFilter" title="Filtrar por responsable"></select>
    <button id="urgentBtn" title="Urgentes: vencen hoy o mañana (U)">📅❗</button>
    <button id="archiveBtn">🗄 Archivadas</button>
    <div class="io-wrap" id="ioWrap">
      <button id="ioBtn" title="Importar / Exportar" aria-expanded="false">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" data-tasking-style="tasking-static-3">
          <path d="M4 1L1 4l3 3M1 4h8M10 13l3-3-3-3M13 10H5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span class="io-label">Datos</span>
        <svg class="io-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
          <path d="M2 3.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="io-panel" id="ioPanel" role="menu">
        <button id="exportCsvBtn" role="menuitem">↓ Exportar CSV</button>
        <button id="exportBtn" role="menuitem">{ } Copiar JSON</button>
        <button id="importBtn" role="menuitem">↑ Importar</button>
      </div>
    </div>
    <input type="file" id="importFile" accept=".csv,.json,application/json,text/csv" hidden>
  </div>
</header>

<div class="board" id="board"></div>
<div class="goals-board" id="goalsBoard" data-tasking-style="tasking-static-4" data-tasking-display="none"></div>

<!-- Panel lateral de objetivos (no bloquea el tablero) -->
<aside class="goals-drawer" id="goalsDrawer" aria-label="Panel de objetivos">
  <div class="goals-drawer-head">
    <span>🎯 Objetivos</span>
    <div class="goals-drawer-actions">
      <button id="goalsExpandBtn" title="Ampliar a pantalla completa">⛶ Ampliar</button>
      <button id="goalsDrawerClose" title="Cerrar panel">✕</button>
    </div>
  </div>
  <div class="goals-drawer-hint">Clic en un objetivo para resaltar sus tarjetas en el tablero.</div>
  <div class="goals-drawer-list" id="goalsDrawerList"></div>
</aside>

<!-- Panel lateral ¿Cómo vamos? (desliza desde la derecha) -->
<aside class="metrics-drawer" id="metricsDrawer" aria-label="Panel ¿Cómo vamos?">
  <div class="metrics-drawer-head">
    <span>📊 ¿Cómo vamos?</span>
    <button id="metricsDrawerClose" title="Cerrar panel">✕</button>
  </div>
  <div class="metrics-stats-row">
    <div class="metrics-stat-box">
      <div class="stat-num" id="mToday">-</div>
      <div class="stat-label">Terminadas hoy</div>
    </div>
    <div class="metrics-stat-box">
      <div class="stat-num" id="mWeek">-</div>
      <div class="stat-label">Esta semana</div>
    </div>
    <div class="metrics-stat-box">
      <div class="stat-num" id="mMonth">-</div>
      <div class="stat-label">Este mes</div>
    </div>
  </div>
  <div class="metrics-section">
    <h3>Velocidad promedio
      <span class="info-tip" tabindex="0">
        <span>i</span>
        <span class="tip-text">Lead time: cuántos días tardaste, en promedio, desde que anotaste una tarea hasta que la terminaste. Cuanto más bajo, mejor.</span>
      </span>
    </h3>
    <p class="section-desc">Días desde que creaste una tarea hasta que la terminaste</p>
    <div>
      <span class="lead-time-big" id="mLeadAvg">-</span>
      <span data-tasking-style="tasking-static-5"> días</span>
    </div>
    <div data-tasking-style="tasking-static-6" id="mLeadSub"></div>
  </div>
  <div class="metrics-section">
    <h3>Ritmo de cierre
      <span class="info-tip" tabindex="0">
        <span>i</span>
        <span class="tip-text">Burn-up: muestra cuántas tareas fuiste cerrando a lo largo del tiempo. Una curva que sube hacia la derecha es la señal de que el equipo avanza.</span>
      </span>
    </h3>
    <p class="section-desc">Tareas terminadas en los últimos 30 días</p>
    <div class="metrics-chart-wrap" id="metricsBurnupWrap"></div>
  </div>
  <div class="metrics-section">
    <h3>Distribución actual
      <span class="info-tip" tabindex="0">
        <span>i</span>
        <span class="tip-text">WIP (Work in Progress): cuántas tareas hay en cada columna ahora mismo. Muchas tareas en una sola columna puede indicar un cuello de botella.</span>
      </span>
    </h3>
    <p class="section-desc">Cuántas tareas hay en cada columna en este momento</p>
    <div class="metrics-chart-wrap" id="metricsWipWrap"></div>
  </div>
  <div class="metrics-section">
    <h3>¡Pilas con esto! 🔥</h3>
    <p class="section-desc">Vencimientos que se acercan primero; después, lo que hace más tiempo que no se toca.</p>
    <div data-tasking-style="tasking-static-7">⏰ Por vencer</div>
    <ul class="stale-list" id="metricsDueSoonList"></ul>
    <div data-tasking-style="tasking-static-8">🔥 Quietas</div>
    <ul class="stale-list" id="metricsStaleList"></ul>
  </div>
</aside>

<div class="wip-toast" id="wipToast">🎯 Dejar de empezar y empezar a terminar</div>

<div class="tip-daily" id="tipDaily" hidden>
  <span class="tip-icon" aria-hidden="true">💡</span>
  <span class="tip-text" id="tipText"></span>
</div>

<footer class="app-footer">
  <span class="shortcuts"><kbd>F</kbd> mis tareas · <kbd>U</kbd> urgentes · <kbd>N</kbd> nueva tarjeta · <kbd>F1</kbd> ayuda</span>
  <span class="dot">·</span>
  <a href="/tareas/novedades" target="_blank" rel="noopener" title="Ver novedades de esta versión">v2.3.2</a>
  <span class="dot">·</span>
  <a href="/tareas/novedades" target="_blank" rel="noopener">Novedades</a>
  <a href="__LEGAL_TERMS__" target="_blank" rel="noopener">Términos</a>
  <a href="__LEGAL_PRIVACY__" target="_blank" rel="noopener">Privacidad</a>
  <a href="https://github.com/pablotortorella/tas-king" target="_blank" rel="noopener">GitHub</a>
  <span class="dot">·</span>
  <span class="credit">Por Pablo Tortorella, en equipo con Claude · <a href="__LEGAL_TERMS__#licencia" target="_blank" rel="noopener">GNU GPL v3</a></span>
</footer>

<!-- Modal de tarjeta -->
<div class="overlay" id="overlay">
  <div class="modal">
    <h2 id="modalTitle">Tarjeta</h2>
    <div class="modal-cols">
      <div class="modal-col-main">
        <div class="field">
          <label>Título</label>
          <input type="text" id="fTitle" placeholder="Título de la tarea">
        </div>
        <div class="field-row">
          <div class="field">
            <label>Columna</label>
            <select id="fColumn"></select>
          </div>
          <div class="field">
            <label>Responsable</label>
            <select id="fAssignee"></select>
          </div>
        </div>
        <div class="field">
          <label>Detalles</label>
          <textarea id="fDetails" placeholder="Descripción, contexto, pasos..."></textarea>
        </div>
        <div id="fChecklistsSection"></div>
        <div class="field">
          <label>Comentarios</label>
          <ul class="comments" id="fComments"></ul>
          <div class="comment-add">
            <input type="text" id="fCommentInput" placeholder="Escribir un comentario...">
            <button class="btn btn-primary btn-small" id="addCommentBtn">Agregar</button>
          </div>
        </div>
        <div class="field" id="historyField" data-tasking-style="tasking-static-9" data-tasking-display="none">
          <label>📜 Historial</label>
          <ul class="history-list" id="fHistory"></ul>
        </div>
      </div>
      <div class="modal-col-side">
        <div class="goals-card-section" id="fGoalsSection"></div>
        <div class="labels-section" id="fLabelsSection"></div>
        <div class="field">
          <label>Fecha límite</label>
          <input type="date" id="fDue">
        </div>
        <div class="field">
          <label>Adjuntos (fotos y archivos)</label>
          <div class="attachments" id="fAttachments"></div>
          <input type="file" id="fFile" multiple accept="*/*">
          <div class="hint">Las imágenes se muestran como miniatura. Los archivos se guardan en el servidor.</div>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <div>
        <button class="btn btn-ghost" id="archiveCardBtn">🗄 Archivar</button>
        <button class="btn btn-danger" id="deleteCardBtn">Eliminar</button>
      </div>
      <div class="right">
        <button class="btn btn-ghost" id="cancelBtn">Cancelar</button>
        <button class="btn btn-primary" id="saveBtn">Guardar</button>
      </div>
    </div>
  </div>
</div>

<!-- Mi perfil -->
<div class="overlay" id="profileOverlay">
  <div class="modal">
    <h2>👤 Mi perfil</h2>
    <div class="profile-preview">
      <span id="profilePreview"></span>
      <span id="profileEmail" class="hint"></span>
    </div>
    <div class="field">
      <label>Nombre para mostrar</label>
      <input type="text" id="profileName" maxlength="60" placeholder="Tu nombre">
    </div>
    <div class="field">
      <label>Emoji del avatar</label>
      <div class="picker" id="emojiPicker"></div>
      <input type="text" id="profileEmoji" maxlength="8" placeholder="o pegá cualquier emoji" data-tasking-style="tasking-static-10">
    </div>
    <div class="field">
      <label>Color</label>
      <div class="picker" id="colorPicker"></div>
    </div>
    <div class="modal-footer">
      <div></div>
      <div class="right">
        <button class="btn btn-ghost" id="profileCancelBtn">Cancelar</button>
        <button class="btn btn-primary" id="profileSaveBtn">Guardar</button>
      </div>
    </div>
  </div>
</div>

<!-- Configuración del tablero (miembros + etiquetas) -->
<div class="overlay" id="membersOverlay">
  <div class="modal">
    <h2 id="membersTitle">⚙️ Configuración</h2>
    <div class="admin-tabs" data-tasking-style="tasking-static-11">
      <button class="tab-btn active" id="settingsTabMiembros">👥 Miembros</button>
      <button class="tab-btn" id="settingsTabEtiquetas">🏷️ Etiquetas</button>
      <button class="tab-btn" id="settingsTabTema">🎨 Tema</button>
    </div>
    <div id="settingsMiembrosPanel">
      <div class="field" id="renameRow" data-tasking-style="tasking-static-12">
        <label>Nombre del tablero</label>
        <div class="comment-add">
          <input type="text" id="renameInput" placeholder="Nombre del tablero">
          <button class="btn btn-primary btn-small" id="renameBtn">Renombrar</button>
        </div>
      </div>
      <div id="membersList"></div>
      <div class="field" id="inviteRow" data-tasking-style="tasking-static-13">
        <label>Invitar por email</label>
        <div class="comment-add">
          <input type="email" id="inviteEmail" placeholder="persona@ejemplo.com">
          <button class="btn btn-primary btn-small" id="inviteBtn">Invitar</button>
        </div>
        <div class="hint">La persona accede con su cuenta de Google la próxima vez que entre.</div>
      </div>
      <div class="field" id="dueSoonRow" data-tasking-style="tasking-static-14">
        <label>¡Pilas con esto! — avisar vencimientos con anticipación</label>
        <div class="comment-add">
          <input type="number" id="dueSoonInput" min="0" max="90" data-tasking-style="tasking-static-15">
          <span data-tasking-style="tasking-static-16">días antes</span>
          <button class="btn btn-primary btn-small" id="dueSoonBtn">Guardar</button>
        </div>
        <div class="hint">Tarjetas con fecha límite más lejana no se muestran como "quietas"; aparecen en "Por vencer" cuando falte esta cantidad de días.</div>
      </div>
    </div>
    <div id="settingsEtiquetasPanel" data-tasking-style="tasking-static-17" data-tasking-display="none">
      <div id="boardLabelsList" data-tasking-style="tasking-static-18"></div>
      <div class="field" data-tasking-style="tasking-static-19">
        <label>Nueva etiqueta</label>
        <input type="text" id="boardLabelName" placeholder="Nombre..." maxlength="30" data-tasking-style="tasking-static-20">
        <div class="label-colors" id="boardColorGrid" data-tasking-style="tasking-static-21"></div>
        <button class="btn btn-primary btn-small" id="boardCreateLabelBtn">Crear etiqueta</button>
      </div>
    </div>
    <div id="settingsTemaPanel" data-tasking-style="tasking-static-22" data-tasking-display="none">
      <div class="hint" data-tasking-style="tasking-static-23">La paleta es del tablero — la ven todos sus miembros, combinada con la preferencia claro/oscuro de cada uno.</div>
      <div class="theme-picker" id="boardThemeGrid"></div>
      <div id="themeOwnerHint" class="hint" data-tasking-style="tasking-static-24" data-tasking-display="none">Solo el dueño del tablero puede cambiar la paleta.</div>
    </div>
    <div class="modal-footer">
      <button class="btn btn-danger" id="deleteBoardBtn">Eliminar tablero</button>
      <div class="right">
        <button class="btn btn-ghost" id="membersCloseBtn">Cerrar</button>
      </div>
    </div>
  </div>
</div>

<!-- Prompt de bienvenida: elegir paleta de color para este tablero (solo dueño, una vez) -->
<div class="overlay" id="themePromptOverlay">
  <div class="modal">
    <h2>🎨 Elegí una paleta para este tablero</h2>
    <p class="hint" data-tasking-style="tasking-static-25">Podés cambiarla cuando quieras desde ⚙️ → Tema. Si no elegís ahora, queda Candy Pop (la oficial).</p>
    <div class="theme-picker" id="themePromptGrid"></div>
    <div class="modal-footer">
      <button class="btn btn-ghost" id="themePromptSkipBtn">Omitir (usar Candy Pop)</button>
      <div class="right"></div>
    </div>
  </div>
</div>

<!-- Lista de tarjetas archivadas -->
<div class="overlay" id="archiveOverlay">
  <div class="modal">
    <h2>🗄 Tarjetas archivadas</h2>
    <div id="archiveList"></div>
    <div class="modal-footer">
      <div></div>
      <div class="right">
        <button class="btn btn-ghost" id="archiveCloseBtn">Cerrar</button>
      </div>
    </div>
  </div>
</div>

<!-- Vista previa de importación -->
<div class="overlay" id="importOverlay">
  <div class="modal">
    <h2>📥 Vista previa de importación</h2>
    <div id="importSummary"></div>
    <div class="modal-footer">
      <div></div>
      <div class="right">
        <button class="btn btn-ghost" id="importCancelBtn">Cancelar</button>
        <button class="btn btn-primary" id="importConfirmBtn">Importar</button>
      </div>
    </div>
  </div>
</div>

<div class="overlay" id="adminOverlay">
  <div class="modal" data-tasking-style="tasking-static-26">
    <h2>⚙ Administración</h2>
    <div class="admin-tabs">
      <button class="tab-btn active" id="adminTabActividad">Actividad del tablero</button>
      <button class="tab-btn" id="adminTabStats">📊 Estadísticas</button>
      <button class="tab-btn" id="adminTabUsuarios">Usuarios</button>
      <button class="tab-btn" id="adminTabSolicitudes">🔔 Solicitudes</button>
    </div>

    <!-- Tab: Usuarios -->
    <div id="adminPanelUsuarios" data-tasking-style="tasking-static-27" data-tasking-display="none">
      <div data-tasking-style="tasking-static-28">
        <input type="email" id="adminNewEmail" placeholder="nuevo@email.com" data-tasking-style="tasking-static-29">
        <button class="btn btn-primary" id="adminAddBtn">Agregar</button>
      </div>
      <div id="adminUserList" data-tasking-style="tasking-static-30"></div>
    </div>

    <!-- Tab: Actividad -->
    <div id="adminPanelActividad">
      <div class="activity-filters">
        <select id="activityUserFilter" title="Filtrar por usuario"></select>
        <input type="date" id="activityFrom" title="Desde">
        <input type="date" id="activityTo" title="Hasta">
        <button class="btn btn-primary btn-small" id="activityFilterBtn">Filtrar</button>
        <button class="btn btn-ghost btn-small" id="activityResetBtn">Limpiar</button>
      </div>
      <div class="activity-list" id="adminActivityList"></div>
    </div>

    <!-- Tab: Estadísticas -->
    <div id="adminPanelStats" data-tasking-style="tasking-static-31" data-tasking-display="none">
      <div data-tasking-style="tasking-static-32">
        <div data-tasking-style="tasking-static-33">
          <div data-tasking-style="tasking-static-34" id="statUsers">-</div>
          <div data-tasking-style="tasking-static-35">Usuarios totales</div>
        </div>
        <div data-tasking-style="tasking-static-36">
          <div data-tasking-style="tasking-static-37" id="statActiveUsers">-</div>
          <div data-tasking-style="tasking-static-38">Activos</div>
        </div>
        <div data-tasking-style="tasking-static-39">
          <div data-tasking-style="tasking-static-40" id="statInactiveUsers">-</div>
          <div data-tasking-style="tasking-static-41">Inactivos</div>
        </div>
      </div>
      <div data-tasking-style="tasking-static-42">
        <div data-tasking-style="tasking-static-43">
          <div data-tasking-style="tasking-static-44" id="statBoards">-</div>
          <div data-tasking-style="tasking-static-45">Tableros</div>
        </div>
        <div data-tasking-style="tasking-static-46">
          <div data-tasking-style="tasking-static-47" id="statCards">-</div>
          <div data-tasking-style="tasking-static-48">Tarjetas activas</div>
        </div>
      </div>

      <!-- Archivos -->
      <div data-tasking-style="tasking-static-49">
        <div data-tasking-style="tasking-static-50">
          <div data-tasking-style="tasking-static-51" id="statFileCount">-</div>
          <div data-tasking-style="tasking-static-52">Archivos</div>
        </div>
        <div data-tasking-style="tasking-static-53">
          <div data-tasking-style="tasking-static-54" id="statFileSize">-</div>
          <div data-tasking-style="tasking-static-55">Tamaño total</div>
        </div>
      </div>

      <!-- Gráfico de uso de cuentas -->
      <div data-tasking-style="tasking-static-56">
        <div data-tasking-style="tasking-static-57">Actividad de cuentas</div>
        <div data-tasking-style="tasking-static-58">
          <div id="userActivityBar" data-tasking-style="tasking-static-59"></div>
        </div>
        <div data-tasking-style="tasking-static-60">
          <span><span data-tasking-style="tasking-static-61"></span>Activos</span>
          <span><span data-tasking-style="tasking-static-62"></span>Inactivos</span>
        </div>
      </div>

      <!-- Top 10 usuarios activos -->
      <div data-tasking-style="tasking-static-63">
        <div data-tasking-style="tasking-static-64">🔥 Top 10 más activos (tableros + tarjetas + comentarios)</div>
        <div id="topUsersList" data-tasking-style="tasking-static-65"></div>
      </div>

      <div id="inactiveUsersSection" data-tasking-style="tasking-static-66" data-tasking-display="none">
        <div data-tasking-style="tasking-static-67">⚠️ Usuarios inactivos (sin acceso):</div>
        <div id="inactiveUsersList" data-tasking-style="tasking-static-68"></div>
      </div>

      <div data-tasking-style="tasking-static-69" id="statsTimestamp"></div>
    </div>

    <!-- Tab: Solicitudes de acceso -->
    <div id="adminPanelSolicitudes" data-tasking-style="tasking-static-70" data-tasking-display="none">
      <p data-tasking-style="tasking-static-71">Usuarios que intentaron entrar pero no tienen acceso. Podés aprobarlos o rechazarlos.</p>
      <div id="adminPendingList" data-tasking-style="tasking-static-72"></div>
    </div>

    <div class="modal-footer" data-tasking-style="tasking-static-73">
      <div></div>
      <button class="btn btn-ghost" id="adminCloseBtn">Cerrar</button>
    </div>
  </div>
</div>

<!-- Modal de Ayuda (F1) -->
<div class="overlay" id="helpModal">
  <div class="modal">
    <h2>⌨️ Atajos de teclado</h2>
    <div data-tasking-style="tasking-static-74">
      <div data-tasking-style="tasking-static-75">
        <kbd data-tasking-style="tasking-static-76">F</kbd>
        <span>Mis tareas (filtro por responsable)</span>
      </div>
      <div data-tasking-style="tasking-static-77">
        <kbd data-tasking-style="tasking-static-78">U</kbd>
        <span>Tareas urgentes (vencen hoy/mañana)</span>
      </div>
      <div data-tasking-style="tasking-static-79">
        <kbd data-tasking-style="tasking-static-80">N</kbd>
        <span>Nueva tarjeta bajo el cursor</span>
      </div>
      <div data-tasking-style="tasking-static-81">
        <kbd data-tasking-style="tasking-static-82">P</kbd>
        <span>Disparar ahora el pulso de tareas en progreso 🎯</span>
      </div>
      <div data-tasking-style="tasking-static-83">
        <kbd data-tasking-style="tasking-static-84">0</kbd>
        <span>Quitar filtro de etiqueta</span>
      </div>
      <div data-tasking-style="tasking-static-85">
        <kbd data-tasking-style="tasking-static-86">1-9</kbd>
        <span>Filtrar por etiqueta 1-9 del tablero</span>
      </div>
      <div data-tasking-style="tasking-static-87">
        <kbd data-tasking-style="tasking-static-88">Esc</kbd>
        <span>Cerrar modal / Cerrar esta ayuda</span>
      </div>
      <div data-tasking-style="tasking-static-89">
        <kbd data-tasking-style="tasking-static-90">F1</kbd>
        <span>Mostrar esta ayuda</span>
      </div>
    </div>
    <div class="modal-footer" data-tasking-style="tasking-static-91">
      <div></div>
      <button class="btn btn-primary" id="helpCloseBtn">Cerrar</button>
    </div>
  </div>
</div>

<!-- Catálogo de tips diarios: el orden del array es la progresión pedagógica -->
<script src="/tareas/tips.js"></script>

<!-- Modulo ES: ejecucion diferida (despues del parseo). tips.js queda como
     script clasico y corre antes, que es lo que garantiza que globalThis.DAILY_TIPS
     ya exista cuando arranca app.js. Ver ADR-017. -->
<script type="module" src="/tareas/js/app.js"></script>
</body>
</html>
`;

// El pie enlaza los textos legales de toda la suite en el sitio del ambiente (los términos propios de Fun TasKing quedan como archivo
// en /tareas/terminos-anteriores).
export function taskingDocument(hostname) {
  const links = legalLinks(hostname);
  return TASKING_DOCUMENT.replaceAll("__LEGAL_TERMS__", links.terms).replaceAll("__LEGAL_PRIVACY__", links.privacy);
}
