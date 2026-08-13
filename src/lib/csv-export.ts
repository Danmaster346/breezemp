// Экспорт табличных данных в CSV (Excel-совместимый: BOM, разделитель ";")

function escapeCsvField(value: string | number | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[";\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Формирует CSV-файл и запускает скачивание в браузере. */
export function exportCsv(
  filename: string,
  headers: string[],
  rows: (string | number | null | undefined)[][],
): void {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(";"));
  const csvContent = "\uFEFF" + lines.join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Формирует имя файла вида kupiks-<base>-YYYY-MM-DD.csv */
export function csvFileName(base: string): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `kupiks-${base}-${yyyy}-${mm}-${dd}.csv`;
}
