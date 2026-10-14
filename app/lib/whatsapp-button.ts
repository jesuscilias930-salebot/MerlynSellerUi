export function whatsappDestination(input: string, required = true): string {
  const raw = input.trim();
  if (!raw && !required) return '';
  if (raw.length > 40 || !/^\+?[\d ()-]+$/.test(raw)) throw new Error('Escribe el número con lada de país, sin enlaces ni letras.');
  const number = raw.replace(/[^\d]/g, '');
  if (!/^[1-9]\d{6,14}$/.test(number)) throw new Error('Incluye la lada de país: el número debe tener entre 7 y 15 dígitos.');
  return number;
}
