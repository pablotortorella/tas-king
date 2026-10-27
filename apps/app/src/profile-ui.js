function escape(value) {
  return String(value).replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function option(value, label, selected) {
  return `<option value="${escape(value)}"${selected ? " selected" : ""}>${escape(label)}</option>`;
}

const COLOR_LABELS = Object.freeze({
  ocean: "Océano", forest: "Bosque", clay: "Arcilla", violet: "Violeta",
  rose: "Rosa", mint: "Menta", cyan: "Cian", slate: "Pizarra", amber: "Ámbar",
});

export function renderProfileForm(profile, csrfToken, saved = false) {
  const source = profile.nameSource;
  const mode = profile.avatar.mode;
  const colors = Object.keys(profile.colors).map((token) =>
    option(token, COLOR_LABELS[token] || token, token === profile.avatar.color)).join("");
  return `<p class="eyebrow">Cuenta de HomeSuite</p><h1>Mi perfil</h1><p>Tu nombre y avatar se comparten entre las herramientas de la suite. El apodo de cada grupo se configura dentro de ese grupo.</p>
    ${saved ? '<p class="notice" role="status">Perfil guardado.</p>' : ""}
    <form id="profile-form" class="card profile-form" data-revision="${profile.revision}" data-csrf="${escape(csrfToken)}">
      <h2>Nombre para mostrar</h2>
      <label class="label" for="name-source">Origen del nombre</label>
      <select id="name-source" name="nameSource">
        ${option("google", `Google${profile.googleDisplayName ? ` · ${profile.googleDisplayName}` : " · sin nombre disponible"}`, source === "google")}
        ${option("custom", "Elegir mi nombre", source === "custom")}
      </select>
      <label class="label" for="display-name">Nombre propio</label>
      <input id="display-name" name="displayName" maxlength="120" value="${escape(source === "custom" ? profile.displayName : "")}" placeholder="Como querés que te vean">
      <h2>Avatar</h2>
      <label class="label" for="avatar-mode">Mostrar</label>
      <select id="avatar-mode" name="avatarMode">
        ${option("google", "Foto de Google, o inicial si no hay foto", mode === "google")}
        ${option("emoji", "Emoji", mode === "emoji")}
        ${option("initial", "Inicial del nombre", mode === "initial")}
      </select>
      <label class="label" for="avatar-emoji">Emoji</label>
      <input id="avatar-emoji" name="emoji" value="${escape(profile.avatar.savedEmoji || "")}" placeholder="Ej. 🌻" autocomplete="off">
      <label class="label" for="avatar-color">Color de fondo</label>
      <select id="avatar-color" name="color">${colors}</select>
      <p class="muted">Si elegís la foto de Google y no está disponible, se muestra la inicial.</p>
      <button class="button" type="submit">Guardar perfil</button>
      <p id="profile-status" role="status" aria-live="polite"></p>
    </form><script src="/profile.js" defer></script>`;
}

export const PROFILE_CLIENT_SCRIPT = `
const form = document.querySelector('#profile-form');
const source = form.elements.namedItem('nameSource');
const name = form.elements.namedItem('displayName');
const mode = form.elements.namedItem('avatarMode');
const emoji = form.elements.namedItem('emoji');
const status = document.querySelector('#profile-status');

function syncFields() {
  name.disabled = source.value !== 'custom';
  name.required = source.value === 'custom';
  emoji.disabled = mode.value !== 'emoji';
  emoji.required = mode.value === 'emoji';
}

source.addEventListener('change', syncFields);
mode.addEventListener('change', syncFields);
syncFields();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = form.querySelector('button[type="submit"]');
  const body = {
    expectedRevision: Number(form.dataset.revision),
    avatarMode: mode.value,
    color: form.elements.namedItem('color').value,
  };
  if (source.value === 'google') body.nameSource = 'google';
  else body.displayName = name.value;
  if (mode.value === 'emoji') body.emoji = emoji.value;
  button.disabled = true;
  status.textContent = 'Guardando…';
  try {
    const response = await fetch('/api/me/profile', {
      method: 'PATCH',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': form.dataset.csrf },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) {
      status.textContent = response.status === 409
        ? 'El perfil cambió en otra pestaña. Recargá esta página antes de guardar.'
        : result.error || 'No pudimos guardar el perfil.';
      return;
    }
    window.location.assign('/perfil?guardado=1');
  } catch {
    status.textContent = 'No pudimos conectar. Revisá tu conexión e intentá de nuevo.';
  } finally {
    button.disabled = false;
  }
});
`;
