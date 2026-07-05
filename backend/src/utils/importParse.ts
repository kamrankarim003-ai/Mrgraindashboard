import ExcelJS from "exceljs";

export async function parseUploadedWorkbook(buffer: Buffer): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return { headers: [], rows: [] };

  const headerRow = sheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell) => headers.push(String(cell.value ?? "").trim()));

  const rows: Record<string, string>[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const record: Record<string, string> = {};
    headers.forEach((header, idx) => {
      const cell = row.getCell(idx + 1);
      record[header] = cell.value === null || cell.value === undefined ? "" : String(cell.value).trim();
    });
    if (Object.values(record).some((v) => v !== "")) rows.push(record);
  });

  return { headers, rows };
}
