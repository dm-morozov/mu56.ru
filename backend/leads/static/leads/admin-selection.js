/* Agreed selection only. Never alter snapshots, prices or send notifications. */
(() => {
  "use strict";
  document.addEventListener("DOMContentLoaded", () => {
    const program = document.getElementById("id_offering");
    const hero = document.getElementById("id_character");
    const secondHero = document.getElementById("id_second_character");
    const extra = document.getElementById("id_second_performer");
    if (!program || !hero || !hero.dataset.choicesUrl) return;
    const message = document.createElement("p");
    message.className = "help";
    message.setAttribute("role", "status");
    message.tabIndex = -1;
    hero.closest(".form-row").append(message);
    const retry = document.createElement("button");
    retry.type = "button";
    retry.textContent = "Повторить загрузку героев";
    retry.hidden = true;
    message.after(retry);
    let controller, pending = false, failed = false;
    async function refresh() {
      if (controller) controller.abort();
      controller = new AbortController();
      const request = controller;
      pending = true; failed = false; hero.disabled = true; retry.hidden = true;
      if (secondHero) secondHero.disabled = true;
      message.textContent = "Обновляем список героев…";
      try {
        const url = new URL(hero.dataset.choicesUrl, window.location.origin);
        url.searchParams.set("offering", program.value);
        const response = await fetch(url, {credentials:"same-origin", cache:"no-store", signal:request.signal});
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (request.signal.aborted) return;
        const previous = hero.value;
        hero.replaceChildren(new Option("---------", ""), ...data.choices.map(item => new Option(item.name, String(item.id))));
        const preserved = data.choices.some(item => String(item.id) === previous);
        hero.value = preserved ? previous : "";
        hero.dispatchEvent(new Event("change", {bubbles:true}));
        const label = document.querySelector('label[for="id_character"]');
        if (label) label.textContent = data.label + ":";
        const primary = document.querySelector(".field-primary_hero .readonly");
        if (primary) primary.textContent = data.primary_hero;
        const clearedExtra = extra && extra.checked && !data.second_performer_allowed;
        if (extra) { if (!data.second_performer_allowed) extra.checked = false; extra.disabled = !data.second_performer_allowed; }
        let clearedSecond = false;
        if (secondHero) {
          const previousSecond = secondHero.value;
          secondHero.replaceChildren(new Option("---------", ""), ...data.choices.map(item => new Option(item.name, String(item.id))));
          const keepSecond = extra && extra.checked && data.second_performer_allowed && data.choices.some(item => String(item.id) === previousSecond);
          secondHero.value = keepSecond ? previousSecond : "";
          clearedSecond = !!previousSecond && !keepSecond;
          secondHero.disabled = !extra || !extra.checked || !data.second_performer_allowed;
          secondHero.dispatchEvent(new Event("change", {bubbles:true}));
        }
        message.textContent = previous && !preserved ? "Предыдущий герой не подходит этой программе. Выберите другого или согласуйте позже." : "Список героев обновлён. Изменения сохранятся только после нажатия «Сохранить».";
        if (clearedExtra) message.textContent += " Доплата второго аниматора снята: она выбирается только в обычном пакете.";
        if (clearedSecond) message.textContent += " Выбор второго героя сброшен; при необходимости выберите подходящего персонажа.";
        pending = false; hero.disabled = false;
      } catch (_) {
        if (request.signal.aborted) return;
        pending = false; failed = true; hero.disabled = false; retry.hidden = false;
        if (secondHero) secondHero.disabled = false;
        message.textContent = "Не удалось обновить героев. Повторите загрузку перед сохранением; введённые данные сохранены в форме.";
      }
    }
    if (window.django && django.jQuery) django.jQuery(program).on("change", refresh);
    else program.addEventListener("change", refresh);
    retry.addEventListener("click", refresh);
    if (extra && secondHero) extra.addEventListener("change", () => {
      if (!extra.checked) secondHero.value = "";
      secondHero.disabled = pending || !extra.checked;
      secondHero.dispatchEvent(new Event("change", {bubbles:true}));
    });
    hero.form.addEventListener("submit", event => {
      if (pending || failed) { event.preventDefault(); message.focus(); }
    });
  });
})();
