import fs from "node:fs";
import path from "node:path";
import mammoth from "mammoth";

const ROOT = path.resolve("incoming", "CrossAI reference");
const MANIFEST_PATH = path.resolve(
    "incoming",
    "reference-manifest.json"
);

if (!fs.existsSync(ROOT)) {
    console.error(`Corpus not found: ${ROOT}`);
    process.exit(1);
}

if (!fs.existsSync(MANIFEST_PATH)) {
    console.error(`Manifest not found: ${MANIFEST_PATH}`);
    process.exit(1);
}

const manifest = JSON.parse(
    fs.readFileSync(MANIFEST_PATH, "utf8")
);

const docxFiles = manifest.filter(
    (file) => file.extension === ".docx"
);

function extractSignals(text) {
    const lower = text.toLowerCase();

    const signals = {
        has1NC: /\b1nc\b/i.test(text),
        has2NC: /\b2nc\b/i.test(text),
        has1AR: /\b1ar\b/i.test(text),
        has2AR: /\b2ar\b/i.test(text),
        has2NR: /\b2nr\b/i.test(text),
        hasCP: /\bcp\b|\bcounterplan\b/i.test(text),
        hasKritik: /\bkritik\b|\bk\b/i.test(text),
        hasTheory: /\btheory\b|\binterp\b|\binterpretation\b/i.test(text),
        hasTopicality: /\btopicality\b|\btopical\b|\bt\b/i.test(text),
        hasFramework: /\bframework\b|\bvalue\b|\bcriterion\b/i.test(text),
        hasPermutation: /\bperm\b|\bpermutation\b/i.test(text),
        hasSolvency: /\bsolvency\b|\bsolves\b/i.test(text),
        hasLink: /\blink\b|\blink turn\b/i.test(text),
        hasImpact: /\bimpact\b|\bterminal impact\b/i.test(text),
        hasWarrant: /\bwarrant\b|\bwarrants\b/i.test(text),
        hasEvidence: /\bcard\b|\bcitation\b|\b\d{4}\b/.test(text),
    };

    return signals;
}

function getLikelyTypes(file, text) {
    const types = new Set();

    const pathLower = file.path.toLowerCase();
    const textLower = text.toLowerCase();

    if (
        pathLower.includes("cp") ||
        /\bcounterplan\b/i.test(text)
    ) {
        types.add("cp");
    }

    if (
        pathLower.includes("k") ||
        /\bkritik\b/i.test(text) ||
        /\bkritiks\b/i.test(text)
    ) {
        types.add("k");
    }

    if (
        pathLower.includes("theory") ||
        pathLower.includes("interp") ||
        /\btheory\b/i.test(text)
    ) {
        types.add("theory");
    }

    if (
        pathLower.includes("topical") ||
        pathLower.includes("non t") ||
        /\btopicality\b/i.test(text)
    ) {
        types.add("topicality");
    }

    if (
        pathLower.includes("framework") ||
        /\bframework\b/i.test(text)
    ) {
        types.add("framework");
    }

    if (
        pathLower.includes("impact") ||
        /\bimpact turn/i.test(text)
    ) {
        types.add("impact");
    }

    if (
        pathLower.includes("pik") ||
        /\bpik\b/i.test(text)
    ) {
        types.add("pik");
    }

    if (
        pathLower.includes("generic") ||
        /\bgeneric\b/i.test(text)
    ) {
        types.add("generic");
    }

    return [...types];
}

const results = [];

console.log(`Inspecting ${docxFiles.length} DOCX files...\n`);

for (let i = 0; i < docxFiles.length; i++) {
    const file = docxFiles[i];

    const absolutePath = path.join(ROOT, file.path);

    try {
        const result = await mammoth.extractRawText({
            path: absolutePath,
        });

        const text = result.value || "";

        const signals = extractSignals(text);
        const likelyTypes = getLikelyTypes(file, text);

        results.push({
            ...file,
            wordCount: text.trim()
                ? text.trim().split(/\s+/).length
                : 0,
            characterCount: text.length,
            likelyTypes,
            signals,
            preview: text
                .replace(/\s+/g, " ")
                .trim()
                .slice(0, 500),
        });
    } catch (error) {
        results.push({
            ...file,
            error: error.message,
        });
    }

    if ((i + 1) % 25 === 0) {
        console.log(`Processed ${i + 1}/${docxFiles.length}`);
    }
}

fs.writeFileSync(
    path.resolve("incoming", "reference-content-analysis.json"),
    JSON.stringify(results, null, 2)
);

console.log("\nDone.");
console.log(
    "Wrote: incoming/reference-content-analysis.json"
);