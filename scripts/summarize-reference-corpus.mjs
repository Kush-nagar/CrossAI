import fs from "node:fs";

const INPUT = "incoming/reference-content-analysis.json";

const data = JSON.parse(fs.readFileSync(INPUT, "utf8"));

function countBy(items, getter) {
    const counts = new Map();

    for (const item of items) {
        const key = getter(item);

        if (!key) continue;

        counts.set(key, (counts.get(key) || 0) + 1);
    }

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1]);
}

function printSection(title, entries) {
    console.log(`\n=== ${title} ===`);

    for (const [key, count] of entries) {
        console.log(`${String(count).padStart(4)}  ${key}`);
    }
}

console.log(`Total analyzed documents: ${data.length}`);

const successful = data.filter((x) => !x.error);
const failed = data.filter((x) => x.error);

console.log(`Successful: ${successful.length}`);
console.log(`Failed: ${failed.length}`);

printSection(
    "Top-level collections",
    countBy(data, (x) => x.directories?.[0])
);

const typeCounts = new Map();

for (const item of data) {
    for (const type of item.likelyTypes || []) {
        typeCounts.set(
            type,
            (typeCounts.get(type) || 0) + 1
        );
    }
}

printSection(
    "Detected argument types",
    [...typeCounts.entries()].sort((a, b) => b[1] - a[1])
);

const signalNames = [
    "has1NC",
    "has2NC",
    "has1AR",
    "has2AR",
    "has2NR",
    "hasCP",
    "hasKritik",
    "hasTheory",
    "hasTopicality",
    "hasFramework",
    "hasPermutation",
    "hasSolvency",
    "hasLink",
    "hasImpact",
    "hasWarrant",
    "hasEvidence",
];

const signalCounts = [];

for (const signal of signalNames) {
    const count = data.filter(
        (x) => x.signals?.[signal]
    ).length;

    signalCounts.push([signal, count]);
}

printSection(
    "Detected structural signals",
    signalCounts.sort((a, b) => b[1] - a[1])
);

const wordCounts = successful
    .map((x) => ({
        path: x.path,
        words: x.wordCount || 0,
    }))
    .sort((a, b) => b.words - a.words);

console.log("\n=== Largest documents ===");

for (const item of wordCounts.slice(0, 20)) {
    console.log(
        `${String(item.words).padStart(7)} words  ${item.path}`
    );
}

console.log("\n=== Smallest documents ===");

for (const item of [...wordCounts].reverse().slice(0, 20)) {
    console.log(
        `${String(item.words).padStart(7)} words  ${item.path}`
    );
}

console.log("\n=== Documents with multiple detected types ===");

const multiType = successful
    .filter((x) => (x.likelyTypes || []).length >= 2)
    .sort(
        (a, b) =>
            b.likelyTypes.length - a.likelyTypes.length
    );

for (const item of multiType.slice(0, 30)) {
    console.log(
        `${item.likelyTypes.join(", ")}  ${item.path}`
    );
}

if (failed.length) {
    console.log("\n=== Failed documents ===");

    for (const item of failed) {
        console.log(`${item.path}: ${item.error}`);
    }
}