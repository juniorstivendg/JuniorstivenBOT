const normal = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

const bold = [
  ...Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1D5D4 + i)),
  ...Array.from({ length: 26 }, (_, i) => String.fromCodePoint(0x1D5EE + i)),
  ...Array.from({ length: 10 }, (_, i) => String.fromCodePoint(0x1D7EC + i))
].join("");

const conversion = new Map(
  Array.from(normal).map((char, i) => [char, Array.from(bold)[i]])
);

function quitarTildes(text) {
  return text.replace(/[áéíóúÁÉÍÓÚüÜ]/g, char => ({
    "á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u",
    "Á": "A", "É": "E", "Í": "I", "Ó": "O", "Ú": "U",
    "ü": "u", "Ü": "U"
  })[char]);
}

export function font(text) {
  return String(text).replace(
    /https?:\/\/[^\s]+|[A-Za-zÀ-ÿ0-9]+/g,
    part => {
      if (/^https?:\/\//i.test(part)) return part;
      return Array.from(quitarTildes(part))
        .map(char => conversion.get(char) || char)
        .join("");
    }
  );
}
