import type * as React from "react";

const INDENT = "  ";

/**
 * textarea の範囲 [start, end) を text で置き換え、選択範囲を selection にする。
 * execCommand を使うとブラウザの Undo 履歴に残り、input イベント経由で onChange も発火する。
 * 使えない環境では setValue で直接更新する。
 */
function replaceRange(
  el: HTMLTextAreaElement,
  start: number,
  end: number,
  text: string,
  selection: [number, number],
  setValue: (value: string) => void,
) {
  el.setSelectionRange(start, end);
  const ok = text === "" ? document.execCommand("delete") : document.execCommand("insertText", false, text);
  if (ok) {
    el.setSelectionRange(...selection);
    return;
  }
  setValue(el.value.slice(0, start) + text + el.value.slice(end));
  requestAnimationFrame(() => el.setSelectionRange(...selection));
}

/**
 * Tab / Shift+Tab でインデント・アウトデントする textarea 用 keydown ハンドラ。
 * - 選択なしで Tab: カーソル位置にインデントを挿入
 * - 選択ありで Tab: 選択範囲の各行をインデント
 * - Shift+Tab: カーソル行 (または選択範囲の各行) をアウトデント
 * Esc を押した直後の Tab / Shift+Tab は通常どおりフォーカス移動になる (キーボード操作の逃げ道)。
 */
export function handleTabIndent(
  e: React.KeyboardEvent<HTMLTextAreaElement>,
  setValue: (value: string) => void,
) {
  const el = e.currentTarget;
  if (e.key === "Escape") {
    el.dataset.tabEscape = "1";
    return;
  }
  const escaped = el.dataset.tabEscape === "1";
  delete el.dataset.tabEscape;
  if (e.key !== "Tab" || escaped || e.ctrlKey || e.metaKey || e.altKey || e.nativeEvent.isComposing) return;
  e.preventDefault();

  const { value, selectionStart: s, selectionEnd: end } = el;
  const outdent = e.shiftKey;

  if (!outdent && s === end) {
    const caret = s + INDENT.length;
    replaceRange(el, s, s, INDENT, [caret, caret], setValue);
    return;
  }

  // 選択範囲が次の行の先頭で終わっている場合、その行は対象外にする
  const effectiveEnd = end > s && value[end - 1] === "\n" ? end - 1 : end;
  const lineStart = value.lastIndexOf("\n", s - 1) + 1;
  const nl = value.indexOf("\n", effectiveEnd);
  const lineEnd = nl === -1 ? value.length : nl;
  const lines = value.slice(lineStart, lineEnd).split("\n");

  const deltas: number[] = [];
  const newLines = lines.map((line) => {
    if (outdent) {
      const n = line.startsWith("\t") ? 1 : Math.min(/^ */.exec(line)?.[0].length ?? 0, INDENT.length);
      deltas.push(-n);
      return line.slice(n);
    }
    // 複数行のインデントでは空行はそのままにする
    if (lines.length > 1 && line.trim() === "") {
      deltas.push(0);
      return line;
    }
    deltas.push(INDENT.length);
    return INDENT + line;
  });

  const total = deltas.reduce((a, b) => a + b, 0);
  if (total === 0) return;

  const newStart = Math.max(lineStart, s + (deltas[0] ?? 0));
  const newEnd = Math.max(newStart, end + total);
  replaceRange(el, lineStart, lineEnd, newLines.join("\n"), [newStart, newEnd], setValue);
}
