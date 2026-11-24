/**
 * 一問一答の採点ロジック。
 * - 全角/半角などの表記ゆれを NFKC で吸収
 * - 前後の空白を除去し、連続する空白を 1 つにまとめる
 * - caseSensitive が false のときは大文字・小文字を区別しない
 */
export function normalizeAnswer(value: string, caseSensitive: boolean) {
  const normalized = value.normalize("NFKC").trim().replace(/\s+/g, " ");
  return caseSensitive ? normalized : normalized.toLowerCase();
}

export function isCorrect(response: string, acceptedAnswers: string[], caseSensitive: boolean) {
  const r = normalizeAnswer(response, caseSensitive);
  if (r === "") return false;
  return acceptedAnswers.some((a) => normalizeAnswer(a, caseSensitive) === r);
}
