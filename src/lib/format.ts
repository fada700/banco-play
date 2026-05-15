export function formatMXN(n: number | string): string {
  const num = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(num)) return "$0.00";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function maskCardNumber(num: string): string {
  const last4 = num.slice(-4);
  return `•••• •••• •••• ${last4}`;
}

export function greetingByHour(name: string): string {
  const h = new Date().getHours();
  if (h < 12) return `Buenos días, ${name}`;
  if (h < 19) return `Buenas tardes, ${name}`;
  return `Buenas noches, ${name}`;
}
