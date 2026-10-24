// Script del navegador que sirve /ledger-ui.js. La CSP sólo admite scripts del mismo origen, así que vive
// como texto servido por la app. Dos funciones: envío optimista del formulario de movimientos y vista
// previa del efecto en los saldos. La vista previa informa; el servidor es quien valida y decide.
export const LEDGER_CLIENT_JS = String.raw`(function () {
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

  function splitEqually(total, count) {
    var base = Math.floor(total / count);
    var rest = total % count;
    var shares = [];
    for (var index = 0; index < count; index++) shares.push(base + (index < rest ? 1 : 0));
    return shares;
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
    form.querySelectorAll(".choice input").forEach(function (input) { names[input.value] = label(input); });
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
      var beneficiaries = Array.prototype.map.call(form.querySelectorAll('input[name="beneficiary"]:checked'), function (input) { return input.value; });
      var method = checkedValue(form, "splitMethod");
      if (!payer) messages.push("Elegí " + (type === "income" ? "quién recibió" : "quién pagó") + ".");
      if (!beneficiaries.length) messages.push("Elegí entre quiénes se reparte.");
      var shares = null;
      if (payer && beneficiaries.length) {
        if (method === "exact") {
          var sum = 0;
          var missing = [];
          shares = beneficiaries.map(function (id) {
            var input = form.querySelector('input[name="share_' + id + '"]');
            var value = input ? parseMinor(input.value, units) : null;
            if (value === null) missing.push(names[id] || id); else sum += value;
            return value;
          });
          if (missing.length) { messages.push("Falta el importe de " + missing.join(", ") + "."); shares = null; }
          else if (sum !== total) { messages.push("Los importes suman " + format(sum, units, currency, false) + " y el total es " + format(total, units, currency, false) + "."); shares = null; }
        } else {
          shares = splitEqually(total, beneficiaries.length);
          var residue = total % beneficiaries.length;
          if (residue) messages.push("Sobran " + residue + " " + (units ? "centavos" : "unidades") + " del reparto: se asignan de a uno a las primeras personas de la lista.");
        }
      }
      if (shares) {
        add(payer, type === "income" ? -total : total);
        beneficiaries.forEach(function (id, index) { add(id, type === "income" ? shares[index] : -shares[index]); });
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
