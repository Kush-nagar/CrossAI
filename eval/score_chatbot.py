import json
import sys
from pathlib import Path

def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def average(scores):
    return round(sum(scores) / len(scores), 2) if scores else 0.0

def main():
    if len(sys.argv) < 3:
        print("Usage: python3 score_chatbot.py <benchmark.json> <results.json>")
        print("Example: python3 eval/score_chatbot.py eval/chatbot-benchmark.json eval/results.json")
        return

    benchmark_path = Path(sys.argv[1])
    results_path = Path(sys.argv[2])

    benchmark = load_json(benchmark_path)
    results = load_json(results_path)

    rubric = benchmark["rubric"]
    metrics = list(rubric.keys())

    all_case_scores = []

    for case in benchmark["cases"]:
        case_id = case["id"]
        result = results.get(case_id)
        if not result:
            print(f"Missing result for {case_id}")
            continue

        scores = {}
        for metric in metrics:
            val = result.get(metric, 0)
            if not isinstance(val, (int, float)):
                try:
                    val = float(val)
                except ValueError:
                    val = 0
            scores[metric] = max(0, min(5, val))

        case_avg = average(list(scores.values()))
        all_case_scores.append((case_id, case_avg, scores))

    print("Benchmark summary")
    print("-" * 40)

    for metric in metrics:
        vals = [r[2][metric] for r in all_case_scores]
        print(f"{metric}: {average(vals)}")

    overall = average([r[1] for r in all_case_scores])
    print(f"overall_average: {overall}")

if __name__ == "__main__":
    main()
