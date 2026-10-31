const BLOCKED_TERMS = [
  "ass",
  "arse",
  "fuck",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "motherfucker",
  "stupid",
  "địt",
  "đụ",
  "đéo",
  "lồn",
  "cặc",
  "đĩ",
  "đồ chó",
  "đồ khốn",
  "giết người",
  "giết chết",
  "đâm chết",
  "bắn chết",
  "tự sát",
  "kill yourself",
  "kill him",
  "kill her",
  "murder",
  "rape",
  "stab someone",
];

export function scanLibraryText(values) {
  const text = values.filter(Boolean).join(" ").normalize("NFC");
  return BLOCKED_TERMS.some((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matcher = /^[\x00-\x7F]+$/.test(term)
      ? new RegExp(`\\b${escaped}\\b`, "i")
      : new RegExp(`(?<![\\p{L}\\p{N}])${escaped}(?![\\p{L}\\p{N}])`, "iu");
    return matcher.test(text);
  });
}

export const LIBRARY_TEXT_WARNING =
  "Exercise content contains inappropriate language. Please revise it!";
