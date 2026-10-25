// Módulo del navegador que sirve /ledger-ui.js. La CSP sólo admite scripts del mismo origen, así que vive como
// texto servido por la app. Funciones: envío optimista del formulario de movimientos, atajo «lo debe todo» y vista
// previa del efecto en los saldos. La vista previa usa la misma regla de reparto que el servidor (/split.js):
// informa, pero el servidor es quien valida y decide.
export const LEDGER_CLIENT_JS = String.raw`import { splitAmount } from "/split.js";
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
          add(payer, type === "income" ? -total : total);
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
  });
})();
`;
