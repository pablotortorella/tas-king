// Módulo del navegador que sirve /ledger-ui.js. La CSP sólo admite scripts del mismo origen, así que vive como
// texto servido por la app. Funciones: envío optimista del formulario de movimientos, atajo «lo debe todo» y vista
// previa del efecto en los saldos. La vista previa usa la misma regla de reparto que el servidor (/split.js):
// informa, pero el servidor es quien valida y decide.
export const LEDGER_CLIENT_JS = String.raw`import { splitAmount } from "/split.js";
import { searchable } from "/text.js";
(function () {
  "use strict";
  var money = new Intl.NumberFormat("es-CO");

  function parseMinor(text, units) {
    text = String(text || "").trim();
    if (!/^\d+(?:[.,]\d+)?$/.test(text)) return null;
    var parts = text.replace(",", ".").split(".");
    var fraction = parts[1] || "";
    if (fraction.length > units) return null;
    var padded = (fraction + "0".repeat(units)).slice(0, units);
    var value = Number(parts[0]) * Math.pow(10, units) + (units ? Number(padded) : 0);
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  function format(minor, units, currency, withSign) {
    var abs = Math.abs(minor);
    var scale = Math.pow(10, units);
    var whole = money.format(Math.floor(abs / scale));
    var fraction = units ? "," + String(abs % scale).padStart(units, "0") : "";
    var sign = minor < 0 ? "−" : withSign && minor > 0 ? "+" : "";
    return sign + currency + " " + whole + fraction;
  }

  function label(input) {
    var span = input.parentElement && input.parentElement.querySelector("span");
    return span ? span.textContent : input.value;
  }

  function checkedValue(form, name) {
    var input = form.querySelector('input[name="' + name + '"]:checked');
    return input ? input.value : null;
  }

  function preview(form) {
    var box = form.querySelector(".effect-preview");
    if (!box) return;
    var list = box.querySelector("ul");
    var note = box.querySelector(".preview-note");
    var option = form.querySelector('select[name="currency"]').selectedOptions[0];
    var units = Number(option.getAttribute("data-units"));
    var currency = option.value;
    var type = form.querySelector('input[name="type"]').value;
    var names = {};
    form.querySelectorAll(".choice input").forEach(function (input) { names[input.value] = input.getAttribute("data-name") || label(input); });
    var amountInput = form.querySelector('input[name="amount"]');
    var total = parseMinor(amountInput.value, units);
    list.textContent = "";
    note.textContent = "";
    note.className = "preview-note hint";
    if (amountInput.value.trim() && total === null) {
      box.hidden = false;
      note.className = "preview-note warn";
      note.textContent = "No entendemos ese importe. Usá coma para los decimales (hasta " + units + ") y no uses puntos para separar miles.";
      return;
    }
    if (total === null) { box.hidden = true; return; }
    box.hidden = false;
    var effects = {};
    function add(id, amount) { effects[id] = (effects[id] || 0) + amount; }
    var messages = [];
    messages.push("Se guardará como " + format(total, units, currency, false) + ".");
    if (type === "transfer") {
      var from = checkedValue(form, "from");
      var to = checkedValue(form, "to");
      if (!from || !to) { messages.push("Elegí quién entrega y quién recibe."); }
      else if (from === to) { messages.push("Quien entrega y quien recibe deben ser personas distintas."); }
      else { add(from, total); add(to, -total); }
    } else {
      var payer = checkedValue(form, "payer");
      var boxes = Array.prototype.slice.call(form.querySelectorAll('input[name="beneficiary"]:checked'));
      var method = checkedValue(form, "splitMethod");
      if (!payer) messages.push("Elegí " + (type === "income" ? "quién recibió" : "quién pagó") + ".");
      if (payer) {
        var prefix = { exact: "share_", percent: "percent_", shares: "parts_", fixed: "fixed_" }[method] || "";
        var inputs = {};
        var order = {};
        boxes.forEach(function (box) {
          order[box.value] = Number(box.getAttribute("data-order"));
          var field = prefix ? form.querySelector('input[name="' + prefix + box.value + '"]') : null;
          inputs[box.value] = field ? field.value : "";
        });
        var result = splitAmount({ totalMinor: total, units: units, currency: currency, method: method, beneficiaries: boxes.map(function (box) { return box.value; }), inputs: inputs, order: order, names: names });
        if (!result.ok) {
          messages.push(result.error);
        } else {
          if (payer === "__keep__") {
            // Varios pagadores conservados: sus aportes viajan en campos ocultos.
            form.querySelectorAll('input[type="hidden"][name^="payerAmount_"]').forEach(function (input) {
              add(input.name.slice("payerAmount_".length), (type === "income" ? -1 : 1) * Number(input.value));
            });
          } else add(payer, type === "income" ? -total : total);
          result.allocations.forEach(function (share) { add(share.participantId, type === "income" ? share.amountMinor : -share.amountMinor); });
          if (result.residue.minor > 0) {
            var unit = units === 2 ? ["centavo", "centavos"] : ["unidad menor", "unidades menores"];
            var who = result.residue.to.map(function (id) { return names[id] || "Participante"; }).join(", ");
            messages.push(result.residue.minor === 1 ? "Queda 1 " + unit[0] + " para " + who + "." : "Quedan " + result.residue.minor + " " + unit[1] + ": uno para cada persona entre " + who + ".");
          }
        }
      }
    }
    Object.keys(effects).forEach(function (id) {
      if (!effects[id]) return;
      var item = document.createElement("li");
      var name = document.createElement("span");
      name.textContent = (names[id] || "Participante");
      var amount = document.createElement("strong");
      amount.className = "money " + (effects[id] > 0 ? "owed" : "owes");
      amount.textContent = format(effects[id], units, currency, true);
      item.append(name, amount);
      list.append(item);
    });
    note.textContent = messages.join(" ");
    if (messages.length > 1 && !Object.keys(effects).length) note.className = "preview-note warn";
  }

  // Atajo «lo debe todo una persona»: deja como única beneficiaria a esa persona con reparto igual. Sin script los
  // botones permanecen ocultos y se elige a mano.
  document.querySelectorAll(".all-to").forEach(function (row) {
    row.hidden = false;
    var form = row.closest("form");
    row.querySelectorAll("[data-all-to]").forEach(function (button) {
      button.addEventListener("click", function () {
        form.querySelectorAll('input[name="beneficiary"]').forEach(function (box) { box.checked = box.value === button.getAttribute("data-all-to"); });
        var equal = form.querySelector('input[name="splitMethod"][value="equal"]');
        if (equal) equal.checked = true;
        form.dispatchEvent(new Event("change", { bubbles: true }));
      });
    });
  });

  // Categoría: un solo campo que filtra mientras se escribe. El <select> y «O escribí una nueva» siguen en el formulario
  // (son lo que se envía, y lo único que hay sin JavaScript); aquí se ocultan y este campo los gobierna. Elegir una fila
  // fija el <select>; un texto que no coincide con ninguna se envía como nombre nuevo, igual que antes (misma forma normalizada).
  var comboCount = 0;
  document.querySelectorAll(".category-field").forEach(function (field) {
    var select = field.querySelector("select");
    var typed = field.querySelector('input[name="categoryNew"]');
    var hint = field.querySelector(".category-hint");
    if (!select || !typed || !hint) return;
    var items = [];
    Array.prototype.forEach.call(select.options, function (option) {
      if (!option.value) return;
      var group = option.parentNode.tagName === "OPTGROUP" ? option.parentNode.label : "";
      var label = option.textContent.trim();
      items.push({ value: option.value, key: option.getAttribute("data-key"), label: label, group: group, name: searchable(label), groupKey: searchable(group) });
    });
    comboCount += 1;
    var listId = "category-list-" + comboCount;
    var wrap = document.createElement("div");
    wrap.className = "cat-combo";
    var label = document.createElement("label");
    label.textContent = "Buscá una o escribí una nueva";
    var inputId = "category-input-" + comboCount;
    label.htmlFor = inputId;
    var box = document.createElement("div");
    box.className = "cat-input";
    var input = document.createElement("input");
    input.id = inputId;
    input.type = "text"; input.maxLength = 60; input.autocomplete = "off"; input.placeholder = "Ej.: Supermercado";
    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");
    input.setAttribute("aria-controls", listId);
    var helpId = "category-help-" + comboCount;
    var helpButton = document.createElement("button");
    helpButton.type = "button"; helpButton.className = "cat-help-btn"; helpButton.textContent = "?";
    helpButton.title = "Ver las categorías disponibles";
    helpButton.setAttribute("aria-label", "Ver las categorías disponibles");
    helpButton.setAttribute("aria-expanded", "false");
    helpButton.setAttribute("aria-controls", helpId);
    box.appendChild(input); box.appendChild(helpButton);
    var list = document.createElement("ul");
    list.id = listId; list.className = "cat-list"; list.hidden = true;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", "Categorías");
    var help = document.createElement("div");
    help.id = helpId; help.className = "cat-help"; help.hidden = true;
    var helpGroup = null;
    items.forEach(function (item) {
      if (!item.group) return;
      if (!helpGroup || helpGroup.name !== item.group) {
        var title = document.createElement("p");
        title.className = "cat-help-group"; title.textContent = item.group;
        var row = document.createElement("div");
        row.className = "cat-help-items";
        help.appendChild(title); help.appendChild(row);
        helpGroup = { name: item.group, row: row };
      }
      var chip = document.createElement("button");
      chip.type = "button"; chip.className = "cat-help-item"; chip.textContent = item.label;
      chip.addEventListener("click", function () { pick({ value: item.value, label: item.label }); });
      helpGroup.row.appendChild(chip);
    });
    var note = document.createElement("p");
    note.className = "cat-help-note"; note.textContent = "Si la que buscás no está, escribila y se crea.";
    help.appendChild(note);
    wrap.appendChild(label); wrap.appendChild(box); wrap.appendChild(list); wrap.appendChild(help);
    field.insertBefore(wrap, hint);
    field.classList.add("is-enhanced");
    var chosen = select.options[select.selectedIndex];
    if (chosen && chosen.value) input.value = chosen.textContent.trim();
    var rows = [];
    var active = -1;

    function setActive(index) {
      active = index;
      rows.forEach(function (row, at) { row.node.classList.toggle("is-active", at === index); row.node.setAttribute("aria-selected", at === index ? "true" : "false"); });
      if (index >= 0) { input.setAttribute("aria-activedescendant", rows[index].node.id); rows[index].node.scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    }
    var helpPinned = false;
    function showHelp(pinned) {
      helpPinned = pinned;
      close();
      help.hidden = false;
      helpButton.setAttribute("aria-expanded", "true");
    }
    function hideHelp() { helpPinned = false; help.hidden = true; helpButton.setAttribute("aria-expanded", "false"); }
    function close() { list.hidden = true; input.setAttribute("aria-expanded", "false"); setActive(-1); }
    function render() {
      var text = input.value;
      var query = searchable(text);
      list.textContent = "";
      rows = [];
      var lastGroup = null;
      items.forEach(function (item) {
        if (query && item.name.indexOf(query) === -1 && item.groupKey.indexOf(query) === -1) return;
        if (item.group !== lastGroup) {
          lastGroup = item.group;
          if (item.group) { var heading = document.createElement("li"); heading.className = "cat-list-group"; heading.setAttribute("role", "presentation"); heading.textContent = item.group; list.appendChild(heading); }
        }
        addRow(item.label, { value: item.value, label: item.label });
      });
      if (query && !items.some(function (item) { return item.key === query; })) addRow("Crear «" + text.trim() + "»", { create: true, label: text.trim() });
      if (!rows.length) { var none = document.createElement("li"); none.className = "cat-list-empty"; none.setAttribute("role", "presentation"); none.textContent = "No hay categorías."; list.appendChild(none); }
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
      setActive(-1);
    }
    function addRow(text, choice) {
      var node = document.createElement("li");
      node.id = listId + "-" + rows.length;
      node.className = "cat-list-option" + (choice.create ? " is-create" : "");
      node.setAttribute("role", "option");
      node.setAttribute("aria-selected", "false");
      node.textContent = text;
      node.addEventListener("mousedown", function (event) { event.preventDefault(); });
      node.addEventListener("click", function () { pick(choice); });
      list.appendChild(node);
      rows.push({ node: node, choice: choice });
    }
    // Lo que se enviará según el texto: nada, una existente (misma forma normalizada que el servidor) o un nombre nuevo.
    function settle(text) {
      var key = searchable(text);
      var match = key && items.filter(function (item) { return item.key === key; })[0];
      if (!key) { select.value = ""; typed.value = ""; hint.textContent = ""; }
      else if (match) { select.value = match.value; typed.value = ""; hint.textContent = "Ya existe «" + match.label + "»: se va a usar esa."; }
      else { select.value = ""; typed.value = text.trim(); hint.textContent = "Se va a crear «" + text.trim() + "» en Mis categorías."; }
    }
    function pick(choice) {
      hideHelp();
      input.value = choice.label;
      if (choice.create) settle(choice.label);
      else { select.value = choice.value; typed.value = ""; hint.textContent = ""; }
      close();
    }
    // El (?): con toque o clic se abre y se queda; en una pantalla con mouse también se asoma al pasar y se va al salir.
    var hoverable = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    helpButton.addEventListener("click", function () {
      if (!help.hidden && helpPinned) hideHelp();
      else showHelp(true);
    });
    if (hoverable) {
      var peek = [helpButton, help];
      peek.forEach(function (node) {
        node.addEventListener("mouseenter", function () { if (help.hidden) showHelp(false); });
        node.addEventListener("mouseleave", function () { if (!helpPinned) hideHelp(); });
      });
    }
    wrap.addEventListener("keydown", function (event) {
      if (event.key !== "Escape" || help.hidden || event.target === input) return;
      event.preventDefault();
      hideHelp();
      helpButton.focus();
    });
    document.addEventListener("pointerdown", function (event) { if (!help.hidden && !wrap.contains(event.target)) hideHelp(); });
    input.addEventListener("input", function () { hideHelp(); settle(input.value); render(); });
    input.addEventListener("focus", function () { if (list.hidden) { hideHelp(); render(); } });
    input.addEventListener("click", function () { if (list.hidden) { hideHelp(); render(); } });
    input.addEventListener("blur", close);
    input.addEventListener("keydown", function (event) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (list.hidden) render();
        if (!rows.length) return;
        var step = event.key === "ArrowDown" ? 1 : -1;
        setActive(active < 0 ? (step > 0 ? 0 : rows.length - 1) : (active + step + rows.length) % rows.length);
      } else if (event.key === "Enter" && !list.hidden && active >= 0) {
        event.preventDefault();
        pick(rows[active].choice);
      } else if (event.key === "Escape" && (!list.hidden || !help.hidden)) {
        event.preventDefault();
        close(); hideHelp();
      }
    });
  });

  document.querySelectorAll("form[data-optimistic]").forEach(function (form) {
    var refresh = function () { preview(form); };
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    refresh();
    form.addEventListener("submit", async function (event) {
      if (!form.reportValidity()) return;
      event.preventDefault();
      var button = form.querySelector('button[type="submit"]');
      var feedback = form.querySelector(".form-feedback");
      var data = new FormData(form);
      var pending = document.createElement("p");
      pending.className = "pending-entry";
      pending.textContent = [data.get("description"), data.get("amount"), data.get("currency"), "pendiente"].filter(Boolean).join(" · ");
      feedback.before(pending);
      feedback.className = "form-feedback";
      feedback.textContent = "Guardando movimiento…";
      button.disabled = true;
      try {
        var response = await fetch(form.action, { method: "POST", body: data, headers: { Accept: "application/json" }, credentials: "same-origin" });
        var result = await response.json();
        if (!response.ok) throw new Error(result.error || "No pudimos guardar el movimiento.");
        location.assign(result.location);
      } catch (error) {
        pending.remove();
        feedback.className = "form-feedback error";
        feedback.textContent = error.message;
        button.disabled = false;
      }
    });
    // Al volver atrás, el navegador puede recuperar el formulario tal como quedó (botón deshabilitado y aviso «pendiente»):
    // se restablece. Reintentar es seguro porque la clave de idempotencia del formulario no cambia.
    window.addEventListener("pageshow", function (event) {
      if (!event.persisted) return;
      var button = form.querySelector('button[type="submit"]');
      var feedback = form.querySelector(".form-feedback");
      form.querySelectorAll(".pending-entry").forEach(function (item) { item.remove(); });
      if (button) button.disabled = false;
      if (feedback) { feedback.className = "form-feedback"; feedback.textContent = ""; }
    });
  });
})();
`;
