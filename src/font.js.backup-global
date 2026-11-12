const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const bold = Array.from({ length: 26 }, (_, i) =>
  String.fromCodePoint(0x1D5D4 + i)
).join("") +
Array.from({ length: 26 }, (_, i) =>
  String.fromCodePoint(0x1D5EE + i)
).join("") +
Array.from({ length: 10 }, (_, i) =>
  String.fromCodePoint(0x1D7EC + i)
).join("");

const conversion = new Map(
  Array.from(normal).map((char, i) => [
    char,
    Array.from(bold)[i]
  ])
);

export function font(text) {
  return Array.from(String(text))
    .map(char => conversion.get(char) || char)
    .join("");
}
