import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import {
  arrayToCsv,
  escapeCsvField,
  createExcelWorkbookBuffer,
  type ColumnDefinition,
} from "../../src/utils/export.utils.js";

test("Excel and CSV Export Unit Tests", async (t) => {
  await t.test("CSV escaping handles commas, quotes, and newlines safely", () => {
    assert.equal(escapeCsvField("Hello World"), "Hello World");
    assert.equal(escapeCsvField("Hello, World"), '"Hello, World"');
    assert.equal(escapeCsvField('Hello "World"'), '"Hello ""World"""');
    assert.equal(escapeCsvField("Line1\nLine2"), '"Line1\nLine2"');
    assert.equal(escapeCsvField(null), "");
    assert.equal(escapeCsvField(undefined), "");
  });

  await t.test("arrayToCsv formats rows properly", () => {
    const headers = ["ID", "Name", "City"];
    const rows = [
      ["1", "Sharma Stores", "Jaipur"],
      ["2", "Gupta, Sons", "Delhi"],
    ];
    const csv = arrayToCsv(headers, rows);
    assert.ok(csv.includes("ID,Name,City"));
    assert.ok(csv.includes('2,"Gupta, Sons",Delhi'));
  });

  await t.test("Generates valid styled Excel buffer with parseable worksheet and headers", async () => {
    const columns: ColumnDefinition[] = [
      { header: "Sale ID", key: "id", width: 25 },
      { header: "Shop Name", key: "shopName", width: 20 },
      { header: "Quantity", key: "quantity", isNumber: true },
      { header: "Amount (₹)", key: "amount", isCurrency: true },
    ];

    const rows = [
      { id: "S001", shopName: "Apollo Pharmacy", quantity: 50, amount: 1250 },
      { id: "S002", shopName: "MedPlus", quantity: 30, amount: 750 },
    ];

    const summary = {
      labelColumnKey: "shopName",
      totals: {
        quantity: 80,
        amount: 2000,
      },
    };

    const buffer = await createExcelWorkbookBuffer("Sales Report", columns, rows, summary);
    assert.ok(buffer);
    assert.ok(buffer.length > 0);

    // Parse the generated buffer with ExcelJS to verify integrity
    const parsedWorkbook = new ExcelJS.Workbook();
    await parsedWorkbook.xlsx.load(buffer as any);

    const worksheet = parsedWorkbook.getWorksheet("Sales Report");
    assert.ok(worksheet, "Worksheet should exist with name 'Sales Report'");

    // Verify headers row
    const headerRow = worksheet.getRow(1);
    assert.equal(headerRow.getCell(1).value, "Sale ID");
    assert.equal(headerRow.getCell(2).value, "Shop Name");
    assert.equal(headerRow.getCell(3).value, "Quantity");
    assert.equal(headerRow.getCell(4).value, "Amount (₹)");
    assert.equal(headerRow.font?.bold, true);

    // Verify row count (1 header + 2 data + 1 summary total)
    assert.equal(worksheet.rowCount, 4);

    // Verify data rows
    const dataRow1 = worksheet.getRow(2);
    assert.equal(dataRow1.getCell(1).value, "S001");
    assert.equal(dataRow1.getCell(2).value, "Apollo Pharmacy");
    assert.equal(dataRow1.getCell(3).value, 50);
    assert.equal(dataRow1.getCell(4).value, 1250);

    // Verify summary totals row
    const totalRow = worksheet.getRow(4);
    assert.equal(totalRow.getCell(2).value, "TOTAL");
    assert.equal(totalRow.getCell(3).value, 80);
    assert.equal(totalRow.getCell(4).value, 2000);
    assert.equal(totalRow.font?.bold, true);
  });

  await t.test("Generates clean Excel file when rows are empty", async () => {
    const columns: ColumnDefinition[] = [
      { header: "ID", key: "id" },
      { header: "Name", key: "name" },
    ];

    const buffer = await createExcelWorkbookBuffer("Empty Report", columns, []);
    assert.ok(buffer.length > 0);

    const parsedWorkbook = new ExcelJS.Workbook();
    await parsedWorkbook.xlsx.load(buffer as any);
    const worksheet = parsedWorkbook.getWorksheet("Empty Report");
    assert.ok(worksheet);
    assert.equal(worksheet.rowCount, 1); // Only header
  });
});
