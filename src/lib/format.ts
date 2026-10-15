export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "—";
  return value.toLocaleString("tr-TR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

const MONTHS_TR = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const day = Number(match[3]);
  const month = Number(match[2]);
  const year = match[1];
  const monthName = MONTHS_TR[month - 1];
  if (!monthName) return value;
  return `${day} ${monthName} ${year}`;
}

export function deltaLabel(value: number | null | undefined): string {
  if (value == null) return "—";
  const formatted = formatNumber(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `−${formatted}`;
  return formatted;
}
