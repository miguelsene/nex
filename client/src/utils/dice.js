// Detecta e rola dados no formato XdY, XdY+Z, XdY-Z
// Ex: "1d20", "2d6+3", "4d8-1", "1d20+1d4"
// Suporta múltiplos grupos na mesma mensagem

const DICE_RE = /\b(\d+)d(\d+)([+-]\d+)?\b/gi;

function rollOne(count, faces) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * faces) + 1);
  return rolls;
}

export function parseDice(text) {
  const groups = [];
  let match;
  DICE_RE.lastIndex = 0;
  while ((match = DICE_RE.exec(text)) !== null) {
    const count = Math.min(parseInt(match[1], 10), 100);  // máx 100 dados
    const faces = Math.min(parseInt(match[2], 10), 10000); // máx d10000
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    if (count < 1 || faces < 2) continue;
    const rolls = rollOne(count, faces);
    const sum = rolls.reduce((a, b) => a + b, 0) + mod;
    groups.push({ expr: match[0], count, faces, mod, rolls, sum });
  }
  return groups;
}

export function hasDice(text) {
  DICE_RE.lastIndex = 0;
  return DICE_RE.test(text);
}
