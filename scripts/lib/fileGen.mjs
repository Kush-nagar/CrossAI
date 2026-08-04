// Turns simple markdown-ish text into PDF / DOCX / XLSX / MD / TXT files.
// Shared by the web server and the CLI so both expose the same generate_file tool.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from "docx";
import ExcelJS from "exceljs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const GENERATED_DIR = path.join(ROOT, "generated");

const SUPPORTED_FORMATS = ["pdf", "docx", "xlsx", "md", "txt"];

function slugify(name) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "document"
  );
}

// Parses a small markdown subset into blocks: headings, bullets, paragraphs.
// Inline bold (**text**) is split into runs of {text, bold}.
function parseInlineRuns(line) {
  const runs = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (!part) continue;
    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      runs.push({ text: boldMatch[1], bold: true });
    } else {
      runs.push({ text: part, bold: false });
    }
  }
  return runs.length ? runs : [{ text: line, bold: false }];
}

function parseMarkdownBlocks(content) {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      blocks.push({ type: "space" });
      continue;
    }
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, runs: parseInlineRuns(headingMatch[2]) });
      continue;
    }
    const bulletMatch = line.match(/^[-*]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push({ type: "bullet", runs: parseInlineRuns(bulletMatch[1]) });
      continue;
    }
    blocks.push({ type: "paragraph", runs: parseInlineRuns(line) });
  }
  return blocks;
}

// Parses a markdown pipe table (| a | b |) into { headers, rows }. Falls back
// to treating each non-empty line as a single-column row if no table is found.
function parseTable(content) {
  const lines = content
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const tableLines = lines.filter((l) => l.startsWith("|"));
  if (tableLines.length >= 2) {
    const splitRow = (l) =>
      l
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim());

    const rows = tableLines
      .map(splitRow)
      .filter((cells) => !cells.every((c) => /^:?-+:?$/.test(c))); // drop separator row

    const [headers, ...body] = rows;
    return { headers, rows: body };
  }

  // Fallback: comma-separated rows, or one column of lines
  const rows = lines.map((l) => (l.includes(",") ? l.split(",").map((c) => c.trim()) : [l]));
  const headers = rows[0] ?? ["Value"];
  return { headers, rows: rows.slice(1) };
}

async function writePdf(outPath, { title, content }) {
  const blocks = parseMarkdownBlocks(content);
  const doc = new PDFDocument({ margin: 54 });
  const chunks = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise((resolve) => doc.on("end", resolve));

  if (title) {
    doc.font("Helvetica-Bold").fontSize(18).text(title);
    doc.moveDown();
  }

  for (const block of blocks) {
    if (block.type === "space") {
      doc.moveDown(0.4);
      continue;
    }
    if (block.type === "heading") {
      doc.moveDown(0.5);
      const size = block.level === 1 ? 15 : block.level === 2 ? 13 : 12;
      doc.font("Helvetica-Bold").fontSize(size);
      doc.text(block.runs.map((r) => r.text).join(""));
      doc.font("Helvetica").fontSize(11);
      continue;
    }
    const prefix = block.type === "bullet" ? "•  " : "";
    doc.fontSize(11);
    doc.text(prefix, { continued: true, indent: block.type === "bullet" ? 10 : 0 });
    block.runs.forEach((run, i) => {
      doc.font(run.bold ? "Helvetica-Bold" : "Helvetica");
      const isLast = i === block.runs.length - 1;
      doc.text(run.text, { continued: !isLast });
    });
    doc.font("Helvetica");
  }

  doc.end();
  await done;
  await fs.writeFile(outPath, Buffer.concat(chunks));
}

async function writeDocx(outPath, { title, content }) {
  const blocks = parseMarkdownBlocks(content);
  const children = [];

  if (title) {
    children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
  }

  for (const block of blocks) {
    if (block.type === "space") {
      children.push(new Paragraph({ text: "" }));
      continue;
    }
    const runs = block.runs.map((r) => new TextRun({ text: r.text, bold: r.bold }));
    if (block.type === "heading") {
      const headingLevel = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3][block.level - 1];
      children.push(new Paragraph({ children: runs, heading: headingLevel }));
    } else if (block.type === "bullet") {
      children.push(new Paragraph({ children: runs, bullet: { level: 0 } }));
    } else {
      children.push(new Paragraph({ children: runs }));
    }
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  await fs.writeFile(outPath, buffer);
}

async function writeXlsx(outPath, { title, content }) {
  const { headers, rows } = parseTable(content);
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(title ? title.slice(0, 31) : "Sheet1");

  sheet.addRow(headers).font = { bold: true };
  for (const row of rows) {
    sheet.addRow(row);
  }
  sheet.columns.forEach((col) => {
    let max = 10;
    col.eachCell?.({ includeEmpty: true }, (cell) => {
      const len = String(cell.value ?? "").length;
      if (len > max) max = len;
    });
    col.width = Math.min(max + 2, 60);
  });

  await workbook.xlsx.writeFile(outPath);
}

async function writeMdOrTxt(outPath, { title, content }) {
  const body = title ? `# ${title}\n\n${content}` : content;
  await fs.writeFile(outPath, body, "utf8");
}

/**
 * Generates a file from markdown-ish content and writes it to generated/.
 * Returns { filename, absPath } — callers build the download reference
 * (a URL for the web app, an absolute path for the CLI) themselves.
 */
export async function generateFile({ filename, format, content, title }) {
  const fmt = String(format ?? "").toLowerCase();
  if (!SUPPORTED_FORMATS.includes(fmt)) {
    throw new Error(`Unsupported format "${format}". Supported: ${SUPPORTED_FORMATS.join(", ")}`);
  }
  if (!content || !content.trim()) {
    throw new Error("content is required and cannot be empty.");
  }

  await fs.mkdir(GENERATED_DIR, { recursive: true });

  const slug = slugify(filename || title || "document");
  let finalName = `${slug}.${fmt}`;
  let outPath = path.join(GENERATED_DIR, finalName);
  let n = 2;
  while (
    await fs
      .access(outPath)
      .then(() => true)
      .catch(() => false)
  ) {
    finalName = `${slug}-${n}.${fmt}`;
    outPath = path.join(GENERATED_DIR, finalName);
    n++;
  }

  if (fmt === "pdf") await writePdf(outPath, { title, content });
  else if (fmt === "docx") await writeDocx(outPath, { title, content });
  else if (fmt === "xlsx") await writeXlsx(outPath, { title, content });
  else await writeMdOrTxt(outPath, { title, content });

  return { filename: finalName, absPath: outPath };
}

export { SUPPORTED_FORMATS, GENERATED_DIR };
