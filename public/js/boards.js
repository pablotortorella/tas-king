// Configuración del tablero y perfil de quien lo usa.
//
// Todo lo que cuelga de ⚙️: miembros, tabs de configuración, paleta de color,
// prompt de bienvenida y administrador de etiquetas del tablero; más el modal de
// perfil, que comparte la misma forma de overlay con formulario.
//
// Exporta dos overlays además de sus funciones. No es por gusto: la cadena de
// Escape vive en app.js y necesita saber cuál está abierto para decidir qué
// cierra. Mientras esa cadena siga siendo un solo lugar, esto es más honesto que
// repartir la decisión.

import { api } from "./core/api.js";
import { emit } from "./core/bus.js";
import { AVATAR_COLORS, LABEL_COLORS, avatarHtml, escapeHtml, shortName } from "./core/dom.js";
import { currentBoard, estado, memberByEmail } from "./core/state.js";
import { PALETTES, applyBoardPalette } from "./theme.js";
import { loadBoard, loadCards, loadMembers, render } from "./board.js";

// ---------- Modal de miembros ----------
export const membersOverlay = document.getElementById("membersOverlay");

// ---------- Configuración del tablero: tabs ----------
function switchSettingsTab(tab) {
  document.getElementById("settingsMiembrosPanel").style.display  = tab === "miembros"  ? "" : "none";
  document.getElementById("settingsEtiquetasPanel").style.display = tab === "etiquetas" ? "" : "none";
  document.getElementById("settingsTemaPanel").style.display      = tab === "tema"      ? "" : "none";
  document.getElementById("settingsTabMiembros").classList.toggle("active",  tab === "miembros");
  document.getElementById("settingsTabEtiquetas").classList.toggle("active", tab === "etiquetas");
  document.getElementById("settingsTabTema").classList.toggle("active",      tab === "tema");
  if (tab === "etiquetas") renderBoardLabelsManager();
  if (tab === "tema") renderBoardThemeManager();
}
document.getElementById("settingsTabMiembros").addEventListener("click",  () => switchSettingsTab("miembros"));
document.getElementById("settingsTabEtiquetas").addEventListener("click", () => switchSettingsTab("etiquetas"));
document.getElementById("settingsTabTema").addEventListener("click",      () => switchSettingsTab("tema"));

// ---------- Selector de paleta del tablero (#10) ----------
function renderBoardThemeManager() {
  const b = currentBoard();
  const isOwner = b && b.role === "owner";
  const current = (b && b.theme) || "candy_pop";
  const grid = document.getElementById("boardThemeGrid");
  grid.innerHTML = "";
  PALETTES.forEach(p => {
    const opt = document.createElement("div");
    opt.className = "theme-opt" + (p.key === current ? " sel" : "") + (isOwner ? "" : " disabled");
    opt.innerHTML = `<span class="theme-swatch" style="background:${p.swatch}"></span><span>${escapeHtml(p.label)}</span>`;
    if (isOwner) {
      opt.addEventListener("click", async () => {
        if (p.key === current) return;
        try {
          await api("PATCH", "/api/boards/" + estado.currentBoardId, { theme: p.key });
          await loadBoard();
          renderBoardThemeManager();
        } catch (e) { alert("No se pudo cambiar la paleta: " + e.message); }
      });
    }
    grid.appendChild(opt);
  });
  document.getElementById("themeOwnerHint").style.display = isOwner ? "none" : "";
}

// ---------- Prompt de bienvenida por tablero (#10) ----------
// Solo el dueño lo ve, y solo una vez por tablero (boards.theme_prompt_seen).
export const themePromptOverlay = document.getElementById("themePromptOverlay");
export function checkThemePrompt() {
  const b = currentBoard();
  if (!b || b.role !== "owner" || b.themePromptSeen) return;
  const grid = document.getElementById("themePromptGrid");
  grid.innerHTML = "";
  PALETTES.forEach(p => {
    const opt = document.createElement("div");
    opt.className = "theme-opt";
    opt.innerHTML = `<span class="theme-swatch" style="background:${p.swatch}"></span><span>${escapeHtml(p.label)}</span>`;
    opt.addEventListener("click", async () => {
      try {
        await api("PATCH", "/api/boards/" + estado.currentBoardId, { theme: p.key });
        themePromptOverlay.classList.remove("open");
        await loadBoard();
      } catch (e) { alert("No se pudo guardar la paleta: " + e.message); }
    });
    grid.appendChild(opt);
  });
  themePromptOverlay.classList.add("open");
}
export async function skipThemePrompt() {
  if (!themePromptOverlay.classList.contains("open")) return;
  try {
    await api("PATCH", "/api/boards/" + estado.currentBoardId, { themePromptSeen: true });
    themePromptOverlay.classList.remove("open");
    await loadBoard();
  } catch (e) { alert("No se pudo guardar: " + e.message); }
}
document.getElementById("themePromptSkipBtn").addEventListener("click", skipThemePrompt);
themePromptOverlay.addEventListener("click", e => { if (e.target === themePromptOverlay) skipThemePrompt(); });

// ---------- Gestión de etiquetas del tablero ----------
function renderBoardLabelsManager() {
  const list = document.getElementById("boardLabelsList");
  list.innerHTML = "";
  if (!estado.boardLabels.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--muted);padding:6px 0">Sin etiquetas en este tablero.</div>';
    return;
  }
  estado.boardLabels.forEach(label => {
    const row = document.createElement("div");
    row.className = "board-label-row";
    row.dataset.id = label.id;
    row.innerHTML = `
      <span class="board-label-swatch" style="background:${label.color}"></span>
      <span class="board-label-name">${escapeHtml(label.name)}</span>
      <div style="display:flex;gap:4px">
        <button class="col-action-btn board-label-edit-btn" data-id="${label.id}" title="Editar">✏️</button>
        <button class="col-action-btn board-label-del-btn" data-id="${label.id}" style="color:var(--danger)" title="Eliminar">✕</button>
      </div>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll(".board-label-edit-btn").forEach(btn => {
    btn.addEventListener("click", () => startEditBoardLabel(btn.dataset.id));
  });
  list.querySelectorAll(".board-label-del-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const label = estado.boardLabels.find(l => l.id === btn.dataset.id);
      if (!label || !confirm(`¿Eliminar la etiqueta "${label.name}"? Se quitará de todas las tarjetas.`)) return;
      try {
        await api("DELETE", `/api/boards/${estado.currentBoardId}/labels/${btn.dataset.id}`);
        await loadCards();
        renderBoardLabelsManager();
      } catch (e) { alert(e.message || "Error al eliminar etiqueta"); }
    });
  });
}

function startEditBoardLabel(labelId) {
  const label = estado.boardLabels.find(l => l.id === labelId);
  if (!label) return;
  const list = document.getElementById("boardLabelsList");
  const row = list.querySelector(`[data-id="${labelId}"]`);
  if (!row) return;

  let editColor = label.color;
  const form = document.createElement("div");
  form.className = "board-label-edit-form";
  form.innerHTML = `
    <input type="text" value="${escapeHtml(label.name)}" maxlength="30" placeholder="Nombre...">
    <div class="label-colors" style="margin-bottom:8px"></div>
    <div style="display:flex;gap:6px">
      <button class="btn btn-primary btn-small" id="saveLabelEditBtn">Guardar</button>
      <button class="btn btn-ghost btn-small" id="cancelLabelEditBtn">Cancelar</button>
    </div>
  `;
  row.replaceWith(form);

  const colorGrid = form.querySelector(".label-colors");
  LABEL_COLORS.forEach(color => {
    const opt = document.createElement("div");
    opt.className = "color-opt" + (color === editColor ? " selected" : "");
    opt.style.backgroundColor = color;
    opt.addEventListener("click", () => {
      form.querySelectorAll(".color-opt").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      editColor = color;
    });
    colorGrid.appendChild(opt);
  });

  form.querySelector("#saveLabelEditBtn").addEventListener("click", async () => {
    const name = form.querySelector("input").value.trim();
    if (!name) return;
    try {
      await api("PUT", `/api/boards/${estado.currentBoardId}/labels/${labelId}`, { name, color: editColor });
      await loadCards();
      renderBoardLabelsManager();
    } catch (e) { alert(e.message || "Error al actualizar etiqueta"); }
  });
  form.querySelector("#cancelLabelEditBtn").addEventListener("click", () => renderBoardLabelsManager());
}

// Color picker para crear etiqueta desde configuración
let boardSelectedColor = LABEL_COLORS[0];
(function initBoardColorGrid() {
  const grid = document.getElementById("boardColorGrid");
  LABEL_COLORS.forEach(color => {
    const opt = document.createElement("div");
    opt.className = "color-opt" + (color === boardSelectedColor ? " selected" : "");
    opt.style.backgroundColor = color;
    opt.addEventListener("click", () => {
      grid.querySelectorAll(".color-opt").forEach(o => o.classList.remove("selected"));
      opt.classList.add("selected");
      boardSelectedColor = color;
    });
    grid.appendChild(opt);
  });
})();

document.getElementById("boardCreateLabelBtn").addEventListener("click", async () => {
  const input = document.getElementById("boardLabelName");
  const name = input.value.trim();
  if (!name) { input.focus(); return; }
  try {
    await api("POST", `/api/boards/${estado.currentBoardId}/labels`, { name, color: boardSelectedColor });
    input.value = "";
    await loadCards();
    renderBoardLabelsManager();
  } catch (e) { alert(e.message || "Error al crear etiqueta"); }
});
document.getElementById("boardLabelName").addEventListener("keydown", e => {
  if (e.key === "Enter") { e.preventDefault(); document.getElementById("boardCreateLabelBtn").click(); }
});

function renderMembers() {
  const b = currentBoard();
  const isOwner = b && b.role === "owner";
  document.getElementById("membersTitle").textContent = "⚙️ " + (b ? b.name : "");
  // invitar, renombrar y eliminar tablero solo para el dueño
  document.getElementById("inviteRow").style.display = isOwner ? "" : "none";
  // renombrar: solo el dueño, y no en el tablero personal
  document.getElementById("renameRow").style.display = (isOwner && b && !b.isPersonal) ? "" : "none";
  document.getElementById("renameInput").value = b ? b.name : "";
  // días de anticipación para "por vencer": solo el dueño lo edita
  document.getElementById("dueSoonRow").style.display = isOwner ? "" : "none";
  document.getElementById("dueSoonInput").value = b ? b.dueSoonDays : 3;
  const delBtn = document.getElementById("deleteBoardBtn");
  delBtn.style.display = (isOwner && b && !b.isPersonal) ? "" : "none";

  const list = document.getElementById("membersList");
  list.innerHTML = estado.members.length ? "" : '<div class="members-empty">Sin miembros.</div>';
  estado.members.forEach(m => {
    const row = document.createElement("div");
    row.className = "member-row";
    const canRemove = isOwner && m.role !== "owner";
    row.innerHTML = `
      <span style="display:flex;align-items:center;gap:8px">${avatarHtml(m, 24)}
        <span>${escapeHtml(m.name || shortName(m.email))} <span class="role">· ${escapeHtml(m.email)} · ${m.role === "owner" ? "dueño" : "miembro"}</span></span></span>
      ${canRemove ? '<button class="btn btn-danger btn-small" data-rm="' + escapeHtml(m.email) + '">Quitar</button>' : ""}
    `;
    const rm = row.querySelector("[data-rm]");
    if (rm) rm.addEventListener("click", async () => {
      try {
        await api("DELETE", "/api/boards/" + estado.currentBoardId + "/members/" + encodeURIComponent(m.email));
        await loadMembers(); renderMembers();
      } catch (e) { alert("No se pudo quitar: " + e.message); }
    });
    list.appendChild(row);
  });
}

document.getElementById("membersBtn").addEventListener("click", () => {
  if (!estado.currentBoardId) return;
  switchSettingsTab("miembros");
  renderMembers();
  membersOverlay.classList.add("open");
});
document.getElementById("membersCloseBtn").addEventListener("click", () => membersOverlay.classList.remove("open"));
membersOverlay.addEventListener("click", e => { if (e.target === membersOverlay) membersOverlay.classList.remove("open"); });

document.getElementById("inviteBtn").addEventListener("click", invite);
document.getElementById("inviteEmail").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); invite(); } });
async function invite() {
  const input = document.getElementById("inviteEmail");
  const email = input.value.trim();
  if (!email) return;
  try {
    await api("POST", "/api/boards/" + estado.currentBoardId + "/members", { email });
    input.value = "";
    await loadBoard();          // actualiza memberCount en el selector
    renderMembers();
  } catch (e) { alert("No se pudo invitar: " + e.message); }
}

document.getElementById("renameBtn").addEventListener("click", renameBoard);
document.getElementById("renameInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); renameBoard(); } });
async function renameBoard() {
  const name = document.getElementById("renameInput").value.trim();
  if (!name) return;
  try {
    await api("PATCH", "/api/boards/" + estado.currentBoardId, { name });
    await loadBoard();          // refresca el nombre en el selector
    renderMembers();
  } catch (e) { alert("No se pudo renombrar: " + e.message); }
}

document.getElementById("dueSoonBtn").addEventListener("click", saveDueSoonDays);
async function saveDueSoonDays() {
  const days = parseInt(document.getElementById("dueSoonInput").value, 10);
  if (!Number.isInteger(days) || days < 0 || days > 90) { alert("Ingresá un número de días entre 0 y 90."); return; }
  try {
    await api("PATCH", "/api/boards/" + estado.currentBoardId, { dueSoonDays: days });
    await loadBoard();
    renderMembers();
  } catch (e) { alert("No se pudo guardar: " + e.message); }
}

document.getElementById("deleteBoardBtn").addEventListener("click", async () => {
  const b = currentBoard();
  if (!b) return;
  if (!confirm(`¿Eliminar el tablero “${b.name}” y todas sus tarjetas?\n\nEsta acción no se puede deshacer.`)) return;
  try {
    await api("DELETE", "/api/boards/" + estado.currentBoardId);
    membersOverlay.classList.remove("open");
    estado.currentBoardId = null;       // loadBoard elegirá el personal
    await loadBoard();
  } catch (e) { alert("No se pudo eliminar el tablero: " + e.message); }
});

// ---------- Perfil: el chip del header y su modal ----------
//
// renderMe dibuja el chip de usuario del encabezado. Vive acá y no en app.js
// porque es la misma información que edita el modal de perfil: guardar el perfil
// tiene que refrescarlo, y separarlos obligaría a un aviso para algo que es una
// sola cosa.

const meProfile = () => ({
  email: estado.me.email,
  name: estado.me.profile.name,
  avatarEmoji: estado.me.profile.avatarEmoji,
  avatarColor: estado.me.profile.avatarColor,
});

export function renderMe() {
  document.getElementById("profileBtn").innerHTML =
    avatarHtml(meProfile(), 22) + "<span>" + escapeHtml(estado.me.profile.name) + "</span>";
  const adminBtn = document.getElementById("adminBtn");
  const adminBadge = document.getElementById("adminBadge");
  adminBtn.style.display = estado.me.isAdmin ? "inline-block" : "none";
  if (estado.me.isAdmin && estado.me.pendingCount > 0) {
    adminBadge.style.display = "block";
    adminBadge.textContent = estado.me.pendingCount;
  } else {
    adminBadge.style.display = "none";
  }
}

// ---------- Modal de perfil ----------
export const profileOverlay = document.getElementById("profileOverlay");
const EMOJI_SET = ["😀","😎","🦊","🐼","🐯","🦁","🐸","🦉","🚀","⭐","🔥","🌈","🎯","🧠","💡","🛠️","📌","🎨","🍀","☕"];
let profileColor = "";

function previewProfile() {
  const emoji = document.getElementById("profileEmoji").value.trim();
  document.getElementById("profilePreview").innerHTML = avatarHtml({
    email: estado.me.email,
    name: document.getElementById("profileName").value || shortName(estado.me.email),
    avatarEmoji: emoji || null,
    avatarColor: profileColor || null,
  }, 40);
  document.querySelectorAll("#colorPicker .opt").forEach(o => o.classList.toggle("sel", o.dataset.color === profileColor));
  document.querySelectorAll("#emojiPicker .opt").forEach(o => o.classList.toggle("sel", o.textContent === emoji));
}

(function buildPickers() {
  const ep = document.getElementById("emojiPicker");
  EMOJI_SET.forEach(em => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt"; b.textContent = em;
    b.addEventListener("click", () => { document.getElementById("profileEmoji").value = em; previewProfile(); });
    ep.appendChild(b);
  });
  const cp = document.getElementById("colorPicker");
  AVATAR_COLORS.forEach(col => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "opt color-opt"; b.style.background = col; b.dataset.color = col;
    b.addEventListener("click", () => { profileColor = col; previewProfile(); });
    cp.appendChild(b);
  });
})();

export function openProfile() {
  document.getElementById("profileName").value = estado.me.profile.name || "";
  document.getElementById("profileEmoji").value = estado.me.profile.avatarEmoji || "";
  document.getElementById("profileEmail").textContent = estado.me.email;
  profileColor = estado.me.profile.avatarColor || "";
  previewProfile();
  profileOverlay.classList.add("open");
}

document.getElementById("profileBtn").addEventListener("click", openProfile);
document.getElementById("profileName").addEventListener("input", previewProfile);
document.getElementById("profileEmoji").addEventListener("input", previewProfile);
document.getElementById("profileCancelBtn").addEventListener("click", () => profileOverlay.classList.remove("open"));
profileOverlay.addEventListener("click", e => { if (e.target === profileOverlay) profileOverlay.classList.remove("open"); });
document.getElementById("profileSaveBtn").addEventListener("click", async () => {
  const btn = document.getElementById("profileSaveBtn");
  btn.disabled = true;
  try {
    const prof = await api("PUT", "/api/me", {
      name: document.getElementById("profileName").value.trim(),
      avatarEmoji: document.getElementById("profileEmoji").value.trim(),
      avatarColor: profileColor,
    });
    estado.me.profile = { name: prof.name, avatarEmoji: prof.avatarEmoji, avatarColor: prof.avatarColor };
    renderMe();
    await loadMembers();   // refresca avatares en filtro y miembros
    render();              // refresca avatares en las tarjetas
    profileOverlay.classList.remove("open");
  } catch (e) { alert("No se pudo guardar el perfil: " + e.message); }
  finally { btn.disabled = false; }
});
