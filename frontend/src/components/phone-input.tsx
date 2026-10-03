"use client";

import { useRef } from "react";

function formatPhone(subscriber: string, country = true) {
  if (!country && !subscriber) return "";
  let result = "+7";
  if (subscriber) result += ` (${subscriber.slice(0, 3)}`;
  if (subscriber.length >= 3) result += ")";
  if (subscriber.length > 3) result += ` ${subscriber.slice(3, 6)}`;
  if (subscriber.length > 6) result += `-${subscriber.slice(6, 8)}`;
  if (subscriber.length > 8) result += `-${subscriber.slice(8, 10)}`;
  return result;
}

function caretAfterDigits(value: string, count: number) {
  if (count <= 0) return 0;
  for (let i = 0; i < value.length; i++) {
    if (/\d/.test(value[i]) && --count === 0) return i + 1;
  }
  return value.length;
}

export function PhoneInput() {
  const previousValue = useRef("");
  function update(input: HTMLInputElement, inputType?: string) {
    const original = input.value;
    const caret = input.selectionStart ?? original.length;
    const digits = original.replace(/\D/g, "");
    const hasCountry = /^[78]/.test(digits);
    let subscriber = (hasCountry ? digits.slice(1) : digits).slice(0, 10);
    const deleting = inputType?.startsWith("delete");
    // Mobile keyboards may delete a separator without emitting a keydown.
    // Remove the adjacent digit too, rather than restoring that separator forever.
    if (deleting && digits === previousValue.current.replace(/\D/g, "")) {
      const positions = Array.from(original.matchAll(/\d/g), match => match.index!);
      const index = inputType?.endsWith("Backward") ? positions.findLastIndex(position => position < caret) : positions.findIndex(position => position >= caret);
      if (index > 0) subscriber = subscriber.slice(0, index - 1) + subscriber.slice(index);
    }
    const next = formatPhone(subscriber, digits.length > 0 && !deleting);
    const digitsBefore = original.slice(0, caret).replace(/\D/g, "").length;
    input.value = next;
    previousValue.current = next;
    const position = caret === original.length ? next.length : caretAfterDigits(next, digitsBefore + (hasCountry ? 0 : 1));
    input.setSelectionRange(position, position);
    input.setCustomValidity(next && subscriber.length !== 10 ? "Введите номер полностью: 10 цифр после +7." : "");
  }
  return <input name="phone" type="tel" inputMode="tel" autoComplete="tel" required
    placeholder="+7 (___) ___-__-__" pattern="\+7 \([0-9]{3}\) [0-9]{3}-[0-9]{2}-[0-9]{2}"
    onChange={event => update(event.currentTarget, (event.nativeEvent as InputEvent).inputType)}
    onKeyDown={event => {
      if (!["Backspace", "Delete"].includes(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.nativeEvent.isComposing) return;
      const input = event.currentTarget, value = input.value;
      if (!value) return;
      const start = input.selectionStart ?? value.length, end = input.selectionEnd ?? start;
      const positions = Array.from(value.matchAll(/\d/g), match => match.index!);
      const subscriber = value.replace(/\D/g, "").slice(1);
      let removed: number[];
      if (start !== end) removed = positions.flatMap((position, index) => index > 0 && position >= start && position < end ? [index - 1] : []);
      else {
        const index = event.key === "Backspace" ? positions.findLastIndex(position => position < start) : positions.findIndex(position => position >= start);
        if (index < 0) return;
        removed = index > 0 ? [index - 1] : [];
      }
      event.preventDefault();
      const remaining = Array.from(subscriber).filter((_, index) => !removed.includes(index)).join("");
      // No permanent country-code stub: deleting the last digit clears the field.
      const next = formatPhone(remaining, remaining.length > 0);
      input.value = next;
      previousValue.current = next;
      const before = positions.filter((position, index) => position < start && index > 0 && !removed.includes(index - 1)).length;
      const caret = remaining ? caretAfterDigits(next, before + 1) : 0;
      input.setSelectionRange(caret, caret);
      input.setCustomValidity(remaining && remaining.length !== 10 ? "Введите номер полностью: 10 цифр после +7." : "");
    }} />;
}
