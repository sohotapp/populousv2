import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import Papa from "papaparse";
import {
  type UploadedData,
  type StoredData,
  setStoredData,
  getStoredData,
  deleteStoredData,
  getAllStoredData,
} from "@/lib/data-store";

// Infer field type from values
function inferFieldType(values: unknown[]): string {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && v !== "");

  if (nonNullValues.length === 0) return "string";

  // Check if all values are numbers
  const allNumbers = nonNullValues.every(v => {
    const num = Number(v);
    return !isNaN(num) && isFinite(num);
  });
  if (allNumbers) return "number";

  // Check if all values are booleans
  const allBooleans = nonNullValues.every(v => {
    const str = String(v).toLowerCase();
    return str === "true" || str === "false" || str === "yes" || str === "no" || str === "1" || str === "0";
  });
  if (allBooleans) return "boolean";

  // Check if all values are dates
  const allDates = nonNullValues.every(v => {
    const date = new Date(String(v));
    return !isNaN(date.getTime()) && String(v).length > 6;
  });
  if (allDates) return "date";

  return "string";
}

// Infer schema from data rows
function inferSchema(rows: Record<string, unknown>[]): UploadedData["schema"] {
  if (rows.length === 0) return { fields: [] };

  const fieldNames = Object.keys(rows[0]);
  const fields = fieldNames.map(name => {
    const values = rows.map(row => row[name]);
    const nullable = values.some(v => v === null || v === undefined || v === "");
    return {
      name,
      type: inferFieldType(values),
      nullable,
    };
  });

  return { fields };
}

// Parse CSV content
async function parseCSV(content: string): Promise<{ rows: Record<string, unknown>[]; errors: string[] }> {
  return new Promise((resolve) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        resolve({
          rows: results.data as Record<string, unknown>[],
          errors: results.errors.map(e => e.message),
        });
      },
      error: (error: Error) => {
        resolve({ rows: [], errors: [error.message] });
      },
    });
  });
}

// Parse JSON content
function parseJSON(content: string): { data: unknown; isArray: boolean } {
  const parsed = JSON.parse(content);
  const isArray = Array.isArray(parsed);
  return { data: parsed, isArray };
}

// Handle file upload
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    const filename = file.name;
    const size = file.size;
    const extension = filename.split(".").pop()?.toLowerCase() || "";

    // Determine file type
    let fileType: UploadedData["type"];
    switch (extension) {
      case "csv":
        fileType = "csv";
        break;
      case "json":
        fileType = "json";
        break;
      case "pdf":
        fileType = "pdf";
        break;
      case "docx":
      case "doc":
        fileType = "docx";
        break;
      case "xlsx":
      case "xls":
        fileType = "xlsx";
        break;
      case "txt":
        fileType = "txt";
        break;
      default:
        return NextResponse.json(
          { error: `Unsupported file type: ${extension}` },
          { status: 400 }
        );
    }

    const content = await file.text();
    const dataId = nanoid(12);
    let rows: Record<string, unknown>[] = [];
    let schema: UploadedData["schema"] = { fields: [] };
    let rawContent: string | undefined;
    let parsedContent: unknown;

    // Parse based on file type
    switch (fileType) {
      case "csv": {
        const { rows: csvRows, errors } = await parseCSV(content);
        if (errors.length > 0 && csvRows.length === 0) {
          return NextResponse.json(
            { error: `CSV parse error: ${errors[0]}` },
            { status: 400 }
          );
        }
        rows = csvRows;
        schema = inferSchema(rows.slice(0, 100)); // Sample first 100 rows for schema
        parsedContent = rows;
        break;
      }

      case "json": {
        try {
          const { data, isArray } = parseJSON(content);
          if (isArray) {
            rows = data as Record<string, unknown>[];
            schema = inferSchema(rows.slice(0, 100));
          } else if (typeof data === "object" && data !== null) {
            rows = [data as Record<string, unknown>];
            schema = inferSchema(rows);
          }
          parsedContent = data;
        } catch {
          return NextResponse.json(
            { error: "Invalid JSON format" },
            { status: 400 }
          );
        }
        break;
      }

      case "txt": {
        rawContent = content;
        schema = {
          fields: [{ name: "content", type: "string", nullable: false }],
        };
        rows = [{ content }];
        parsedContent = content;
        break;
      }

      case "pdf":
      case "docx":
      case "xlsx": {
        // For binary formats, store the raw content
        // Real parsing happens in the executor
        rawContent = content;
        schema = {
          fields: [{ name: "content", type: "string", nullable: false }],
        };
        parsedContent = content;

        // For PDF/DOCX, we'll parse properly in compute executor
        // This is placeholder schema
        if (fileType === "pdf" || fileType === "docx") {
          schema = {
            fields: [
              { name: "text", type: "string", nullable: false },
              { name: "pages", type: "number", nullable: true },
              { name: "metadata", type: "object", nullable: true },
            ],
          };
        }
        break;
      }
    }

    const uploadedData: StoredData = {
      dataId,
      filename,
      type: fileType,
      schema,
      rowCount: rows.length,
      preview: rows.slice(0, 10),
      size,
      uploadedAt: new Date().toISOString(),
      rawContent,
      content: parsedContent,
    };

    // Store in memory
    setStoredData(dataId, uploadedData);

    // Return response without the full content
    const response: UploadedData = {
      dataId,
      filename,
      type: fileType,
      schema,
      rowCount: rows.length,
      preview: rows.slice(0, 10),
      size,
      uploadedAt: uploadedData.uploadedAt,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}

// Get uploaded data by ID
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataId = searchParams.get("id");

  if (!dataId) {
    // Return list of all uploaded data
    const allData = getAllStoredData();
    return NextResponse.json({ data: allData });
  }

  const data = getStoredData(dataId);
  if (!data) {
    return NextResponse.json(
      { error: "Data not found" },
      { status: 404 }
    );
  }

  // Return full content for specific ID
  return NextResponse.json(data);
}

// Delete uploaded data
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dataId = searchParams.get("id");

  if (!dataId) {
    return NextResponse.json(
      { error: "Data ID required" },
      { status: 400 }
    );
  }

  const deleted = deleteStoredData(dataId);
  if (!deleted) {
    return NextResponse.json(
      { error: "Data not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
