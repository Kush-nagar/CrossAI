import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import { DOMParser } from "@xmldom/xmldom";

// Collapse mid-word line-wrap hyphenation ("argu-\nment" -> "argument"),
// then normalize remaining whitespace without destroying paragraph breaks.
export function cleanText(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/-\n(?=[a-z])/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

// OOXML's w:highlight only allows this fixed color enum (not arbitrary hex).
const HIGHLIGHT_COLORS = {
  black: "#000000", blue: "#0000FF", cyan: "#00FFFF", darkBlue: "#00008B",
  darkCyan: "#008B8B", darkGray: "#A9A9A9", darkGreen: "#006400", darkMagenta: "#8B008B",
  darkRed: "#8B0000", darkYellow: "#808000", green: "#00FF00", lightGray: "#D3D3D3",
  magenta: "#FF00FF", red: "#FF0000", white: "#FFFFFF", yellow: "#FFFF00",
};

// Debate cards mark what's actually read aloud with highlighting (or, less often,
// character shading) in the source .docx. Cut evidence is meaningless for delivery
// purposes without that distinction, so pull run-level w:highlight/w:shd/w:b/w:i/w:u
// out of the raw document.xml — see CROSS.md's card-reading section.
function getRunFormatting(run) {
  const format = { bold: false, italic: false, underline: false, highlightColor: null };
  const rPr = run.getElementsByTagNameNS(W_NS, "rPr")[0];
  if (!rPr) return format;

  if (rPr.getElementsByTagNameNS(W_NS, "b")[0]) format.bold = true;
  if (rPr.getElementsByTagNameNS(W_NS, "i")[0]) format.italic = true;
  const u = rPr.getElementsByTagNameNS(W_NS, "u")[0];
  if (u) {
    const val = u.getAttributeNS(W_NS, "val") || u.getAttribute("w:val");
    if (val && val !== "none") format.underline = true;
  }

  const highlight = rPr.getElementsByTagNameNS(W_NS, "highlight")[0];
  if (highlight) {
    const val = highlight.getAttributeNS(W_NS, "val") || highlight.getAttribute("w:val");
    if (val && val !== "none") format.highlightColor = HIGHLIGHT_COLORS[val] || "#FFFF00";
  }
  if (!format.highlightColor) {
    const shd = rPr.getElementsByTagNameNS(W_NS, "shd")[0];
    if (shd) {
      const fill = (shd.getAttributeNS(W_NS, "fill") || shd.getAttribute("w:fill") || "").toLowerCase();
      if (fill && fill !== "auto" && fill !== "ffffff") format.highlightColor = `#${fill}`;
    }
  }

  return format;
}

function runText(run) {
  let text = "";
  const children = run.childNodes;
  for (let i = 0; i < children.length; i++) {
    const node = children[i];
    if (node.nodeType !== 1) continue;
    if (node.localName === "t") text += node.textContent;
    else if (node.localName === "tab") text += "\t";
    else if (node.localName === "br" || node.localName === "cr") text += "\n";
  }
  return text;
}

function paragraphsFromDocXml(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  return doc.getElementsByTagNameNS(W_NS, "p");
}

function extractDocxWithHighlights(xml) {
  const paragraphs = paragraphsFromDocXml(xml);
  const lines = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const runs = paragraphs[i].getElementsByTagNameNS(W_NS, "r");
    let line = "";
    let markOpen = false;
    for (let j = 0; j < runs.length; j++) {
      const text = runText(runs[j]);
      if (!text) continue;
      const highlighted = !!getRunFormatting(runs[j]).highlightColor;
      if (highlighted && !markOpen) {
        line += "<mark>";
        markOpen = true;
      } else if (!highlighted && markOpen) {
        line += "</mark>";
        markOpen = false;
      }
      line += text;
    }
    if (markOpen) line += "</mark>";
    lines.push(line);
  }
  return lines.join("\n");
}

async function extractDocx(buf) {
  try {
    const zip = await JSZip.loadAsync(buf);
    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) throw new Error("word/document.xml not found");
    const xml = await docXmlFile.async("string");
    const withHighlights = extractDocxWithHighlights(xml);
    if (withHighlights.trim()) return withHighlights;
  } catch (err) {
    console.error("Highlight-aware DOCX extraction failed, falling back to plain text:", err.message);
  }
  const mammoth = (await import("mammoth")).default;
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return value;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Renders a .docx as real HTML — bold/italic/underline as semantic tags, and
// highlight/shading as an inline-colored <mark> — for visual display of the
// original formatting (as opposed to extractDocx's plain-text + <mark> output,
// which is what the corpus/AI-facing text actually uses).
export async function convertDocxToHtml(buf) {
  const zip = await JSZip.loadAsync(buf);
  const docXmlFile = zip.file("word/document.xml");
  if (!docXmlFile) throw new Error("word/document.xml not found");
  const xml = await docXmlFile.async("string");
  const paragraphs = paragraphsFromDocXml(xml);

  const htmlParagraphs = [];
  for (let i = 0; i < paragraphs.length; i++) {
    const runs = paragraphs[i].getElementsByTagNameNS(W_NS, "r");
    let inner = "";
    for (let j = 0; j < runs.length; j++) {
      const text = runText(runs[j]);
      if (!text) continue;
      const fmt = getRunFormatting(runs[j]);
      let span = escapeHtml(text).replace(/\n/g, "<br>");
      if (fmt.bold) span = `<strong>${span}</strong>`;
      if (fmt.italic) span = `<em>${span}</em>`;
      if (fmt.underline) span = `<u>${span}</u>`;
      if (fmt.highlightColor) span = `<mark style="background:${fmt.highlightColor}">${span}</mark>`;
      inner += span;
    }
    htmlParagraphs.push(`<p>${inner || "&nbsp;"}</p>`);
  }
  return htmlParagraphs.join("\n");
}

// PDF highlight annotations (subtype "Highlight") record their quad-point boxes;
// text content items carry their own position via a transform matrix. Neither
// references the other directly, so a highlighted span is recovered by overlap:
// any text item whose box mostly falls inside a highlight's box is marked.
function quadPointsToRects(quadPoints) {
  const rects = [];
  for (let i = 0; i + 7 < quadPoints.length; i += 8) {
    const xs = [quadPoints[i], quadPoints[i + 2], quadPoints[i + 4], quadPoints[i + 6]];
    const ys = [quadPoints[i + 1], quadPoints[i + 3], quadPoints[i + 5], quadPoints[i + 7]];
    rects.push({ x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) });
  }
  return rects;
}

function overlapFraction(item, rect) {
  const xOverlap = Math.max(0, Math.min(item.x1, rect.x1) - Math.max(item.x0, rect.x0));
  const yOverlap = Math.max(0, Math.min(item.y1, rect.y1) - Math.max(item.y0, rect.y0));
  const itemArea = (item.x1 - item.x0) * (item.y1 - item.y0);
  if (itemArea <= 0) return 0;
  return (xOverlap * yOverlap) / itemArea;
}

async function extractPdfWithHighlights(buf) {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const pdf = await getDocument({ data: new Uint8Array(buf), useSystemFonts: true }).promise;

  const pageTexts = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const [annotations, textContent] = await Promise.all([page.getAnnotations(), page.getTextContent()]);

    const highlightRects = annotations
      .filter((a) => a.subtype === "Highlight" && Array.isArray(a.quadPoints))
      .flatMap((a) => quadPointsToRects(a.quadPoints));

    let line = "";
    let markOpen = false;
    for (const item of textContent.items) {
      if (!item.str) {
        if (item.hasEOL) line += "\n";
        continue;
      }
      const [, , , , e, f] = item.transform;
      const height = item.height || 10;
      const itemBox = { x0: e, x1: e + item.width, y0: f, y1: f + height };
      const highlighted = highlightRects.some((rect) => overlapFraction(itemBox, rect) > 0.5);

      if (highlighted && !markOpen) {
        line += "<mark>";
        markOpen = true;
      } else if (!highlighted && markOpen) {
        line += "</mark>";
        markOpen = false;
      }
      line += item.str;
      if (item.hasEOL) line += "\n";
    }
    if (markOpen) line += "</mark>";
    pageTexts.push(line);
  }
  return pageTexts.join("\n\n");
}

async function extractPdf(buf) {
  try {
    const withHighlights = await extractPdfWithHighlights(buf);
    if (withHighlights.trim()) return withHighlights;
  } catch (err) {
    console.error("Highlight-aware PDF extraction failed, falling back to plain text:", err.message);
  }
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buf);
  return data.text;
}

// Extracts raw text from a file on disk. Returns null for unsupported types.
export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buf = await fs.readFile(filePath);
  return extractTextFromBuffer(buf, ext);
}

// Extracts raw text from an in-memory buffer, given its extension
// (".pdf", ".docx", ".html", ".txt", ".md"). Returns null if unsupported.
// For PDF/DOCX, highlighted spans (what a debater actually reads aloud from a
// card, as opposed to the full cut text) are wrapped in <mark>...</mark>.
export async function extractTextFromBuffer(buf, ext) {
  if (ext === ".pdf") {
    return extractPdf(buf);
  }
  if (ext === ".docx") {
    return extractDocx(buf);
  }
  if (ext === ".html" || ext === ".htm") {
    const { convert } = await import("html-to-text");
    return convert(buf.toString("utf8"), { wordwrap: false });
  }
  if (ext === ".txt" || ext === ".md") {
    return buf.toString("utf8");
  }
  return null;
}
