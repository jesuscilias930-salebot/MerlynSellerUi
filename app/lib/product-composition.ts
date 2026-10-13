export const COMPOSITION_LIMIT = 20;
export const COMPONENT_LENGTH = 150;
export function compositionLines(text: string): string[] {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (lines.length > COMPOSITION_LIMIT) throw new Error(`Agrega hasta ${COMPOSITION_LIMIT} componentes.`);
  if (lines.some(line => line.length > COMPONENT_LENGTH || /[\u0000-\u001f\u007f]/.test(line)))
    throw new Error(`Cada componente debe tener hasta ${COMPONENT_LENGTH} caracteres, sin caracteres de control.`);
  return lines;
}
