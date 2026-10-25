// Public URL filters encode source bits. Preserve the September assignments
// across changing catalogue sizes, absent feeds and newly recovered sources.
export const SOURCE_IDS = Object.freeze([
  'garnet', 'pharmily', 'healthyu', 'medmarket', 'goodlife', 'portal',
  'tims', 'kalonji', 'rangechem', 'healthcart', 'hinata', 'transwide',
  'malibu', 'nilapharm', 'onestop', 'pharmaplus', 'mydawa', 'faiz',
]);

export function sourceBit(id) {
  const bit = SOURCE_IDS.indexOf(id);
  if (bit < 0 || bit > 30) throw new Error(`Source needs a permanent URL bit: ${id}`);
  return bit;
}
