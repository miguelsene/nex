// Detecta e rola dados no formato XdY, XdY+Z, XdY-Z
// Ex: "1d20", "2d6+3", "4d8-1", "1d20+1d4"
// Suporta múltiplos grupos na mesma mensagem

const DICE_RE = /\b(\d+)d(\d+)([+-]\d+)?\b/gi;

function seededRandom(seed) {
  let value = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    value = Math.imul(value ^ seed.charCodeAt(index), 16777619);
  }
  return () => {
    value += 0x6D2B79F5;
    let result = Math.imul(value ^ (value >>> 15), 1 | value);
    result ^= result + Math.imul(result ^ (result >>> 7), 61 | result);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function rollOne(count, faces, random) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(random() * faces) + 1);
  return rolls;
}

export function parseDice(text, rollId = text) {
  const groups = [];
  const random = seededRandom(String(rollId));
  let match;
  DICE_RE.lastIndex = 0;
  while ((match = DICE_RE.exec(text)) !== null) {
    const count = Math.min(parseInt(match[1], 10), 100);  // máx 100 dados
    const faces = Math.min(parseInt(match[2], 10), 10000); // máx d10000
    const mod = match[3] ? parseInt(match[3], 10) : 0;
    if (count < 1 || faces < 2) continue;
    const rolls = rollOne(count, faces, random);
    const sum = rolls.reduce((a, b) => a + b, 0) + mod;
    groups.push({ expr: match[0], count, faces, mod, rolls, sum });
  }
  return groups;
}

export function hasDice(text) {
  DICE_RE.lastIndex = 0;
  return DICE_RE.test(text);
}
