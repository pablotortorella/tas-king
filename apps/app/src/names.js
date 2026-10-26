// Dos nombres son «el mismo» sin distinguir mayúsculas, tildes ni espacios repetidos.
export const nameKey = value => value.normalize("NFD").replace(/[̀-ͯ]/gu, "").toLowerCase().replace(/\s+/gu, " ").trim();
