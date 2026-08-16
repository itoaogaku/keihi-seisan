/**
 * 日本のクレジットカード会社が配布するCSVはShift_JIS(CP932)であることが多く、
 * そのままUTF-8として読むと文字化けする。UTF-8として妥当かどうかをまず厳密判定し、
 * 不正なバイト列であればShift_JISとして読み直す。
 */
export function decodeCsvArrayBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("shift_jis").decode(buffer);
  }
}
