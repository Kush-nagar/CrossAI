import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("incoming", "CrossAI reference");

const SUPPORTED_EXTENSIONS = new Set([
    ".docx",
    ".pdf",
    ".txt",
    ".md",
    ".html",
    ".htm",
]);

function walk(dir) {
    const results = [];

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results.push(...walk(fullPath));
        } else {
            results.push(fullPath);
        }
    }

    return results;
}

if (!fs.existsSync(ROOT)) {
    console.error(`Corpus directory not found: ${ROOT}`);
    process.exit(1);
}

const files = walk(ROOT)
    .filter((file) =>
        SUPPORTED_EXTENSIONS.has(path.extname(file).toLowerCase())
    )
    .map((file) =>
        path.relative(ROOT, file).split(path.sep).join("/")
    )
    .sort();

const manifest = files.map((file) => {
    const parts = file.split("/");
    const filename = parts.at(-1);

    return {
        path: file,
        filename,
        extension: path.extname(filename).toLowerCase(),
        directories: parts.slice(0, -1),
    };
});

console.log(`Found ${manifest.length} supported files.\n`);

console.log("First 20 files:\n");

for (const item of manifest.slice(0, 20)) {
    console.log(JSON.stringify(item, null, 2));
}

fs.writeFileSync(
    path.resolve("incoming", "reference-manifest.json"),
    JSON.stringify(manifest, null, 2)
);

console.log("\nManifest written to:");
console.log("incoming/reference-manifest.json");