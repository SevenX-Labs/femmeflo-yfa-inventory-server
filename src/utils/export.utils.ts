import ExcelJS from "exceljs";

export function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function arrayToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const headerLine = headers.map(escapeCsvField).join(",");
  const dataLines = rows.map((row) => row.map(escapeCsvField).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export interface ColumnDefinition {
  header: string;
  key: string;
  width?: number;
  isCurrency?: boolean;
  isNumber?: boolean;
  isDate?: boolean;
}

export interface SummaryTotals {
  labelColumnKey: string;
  totals: Record<string, number | string>;
}

export async function createExcelWorkbookBuffer(
  sheetName: string,
  columns: ColumnDefinition[],
  rows: Record<string, unknown>[],
  summary?: SummaryTotals,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "FemmeFlo Inventory System";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  sheet.columns = columns.map((col) => ({
    header: col.header,
    key: col.key,
    width: col.width || 20,
  }));

  // Style header row
  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
  headerRow.eachCell((cell) => {
    cell.font = { name: "Arial", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A8A" }, // Navy Blue
    };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
    };
  });

  // Populate data rows
  rows.forEach((row, index) => {
    const sheetRow = sheet.addRow(row);
    sheetRow.height = 20;

    // Zebra striping
    if (index % 2 === 1) {
      sheetRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      });
    }

    // Cell formatting
    columns.forEach((col) => {
      const cell = sheetRow.getCell(col.key);
      if (col.isCurrency) {
        cell.numFmt = '"₹"#,##0.00';
        cell.alignment = { horizontal: "right" };
      } else if (col.isNumber) {
        cell.numFmt = '#,##0';
        cell.alignment = { horizontal: "right" };
      }
    });
  });

  // Append Summary Totals row if provided
  if (summary) {
    const totalRowData: Record<string, unknown> = {
      [summary.labelColumnKey]: "TOTAL",
      ...summary.totals,
    };
    const totalRow = sheet.addRow(totalRowData);
    totalRow.height = 24;
    totalRow.font = { name: "Arial", size: 11, bold: true };
    totalRow.eachCell((cell) => {
      cell.font = { name: "Arial", size: 11, bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE2E8F0" },
      };
      cell.border = {
        top: { style: "thin", color: { argb: "FF64748B" } },
        bottom: { style: "double", color: { argb: "FF0F172A" } },
      };
    });

    // Format numbers in total row as well
    columns.forEach((col) => {
      if (summary.totals[col.key] !== undefined) {
        const cell = totalRow.getCell(col.key);
        if (col.isCurrency) {
          cell.numFmt = '"₹"#,##0.00';
          cell.alignment = { horizontal: "right" };
        } else if (col.isNumber) {
          cell.numFmt = '#,##0';
          cell.alignment = { horizontal: "right" };
        }
      }
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
