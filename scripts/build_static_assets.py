#!/usr/bin/env python3
"""Build static assets for the Flat-Pack Bench project page.

This script intentionally writes only into this repository's assets/ tree.
It copies source PDFs/supplementary media, normalizes JSON data, resolves any
locally available prompt images, and optionally transcodes viewer videos.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
from collections import Counter, defaultdict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
DATA_DIR = ASSETS / "data"

PAPER_PDF = Path("/Users/justachetan/Downloads/flat_pack_bench_arxiv.pdf")
SUPPLEMENTARY_ROOT = Path("/Users/justachetan/Downloads/old_supplementary")
SUPPLEMENTARY_PDF = SUPPLEMENTARY_ROOT / "flat_pack_bench_cvpr_2026_submission_supplementary.pdf"
QUESTION_DATA_ROOT = Path("/Users/justachetan/work/research/flat-pack-bench-data")
VIDEO_ROOT = Path("/Users/justachetan/work/research/videos")
PROMPT_IMAGE_ROOT = Path("/Users/justachetan/Downloads/prompt_images")
MODEL_RESPONSES_ROOT = Path("/Users/justachetan/work/research/model_responses")
VIDEO_ASSET_ROOT = VIDEO_ROOT / "assets" / "videos"
VIDEO_PUBLIC_BASE = "https://flat-pack-bench.github.io/videos/assets/videos"

CATEGORY_LABELS = {
    "temporal_loc": "Temporal Localization",
    "temporal_ord": "Temporal Ordering",
    "mating": "Mating",
    "tracking": "Tracking",
}

MODEL_DISPLAY_NAMES = {
    "gemini_25_pro_sep_media_first_keyframe_video": "Gemini 2.5 Pro",
    "internvl3_78b_concat_media_first_keyframe_video": "InternVL3-78B",
    "openai_gpt5_sep_media_first_keyframe_video": "OpenAI GPT-5",
    "qwen_2_5_vl_72b_sep_media_first_trimmed_video": "Qwen2.5-VL-72B",
    "qwen_3_vl_32b_thinking_collage_media_first_trimmed_video": "Qwen3-VL-32B-Thinking",
}


def read_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_jsonl(path: Path) -> list[dict]:
    rows = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                rows.append(json.loads(line))
    return rows


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=True)
        handle.write("\n")


def copy_if_exists(source: Path, target: Path) -> bool:
    if not source.exists():
        return False
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, target)
    return True


def copy_supplementary_media() -> dict:
    copied = {}
    supp_assets = SUPPLEMENTARY_ROOT / "assets"
    target_root = ASSETS / "supplementary"
    target_root.mkdir(parents=True, exist_ok=True)

    for folder in ("sep", "sectionb", "sectiond", "sectiond_1"):
        source = supp_assets / folder
        target = target_root / folder
        if not source.exists():
            copied[folder] = 0
            continue
        shutil.copytree(
            source,
            target,
            dirs_exist_ok=True,
            ignore=shutil.ignore_patterns(".DS_Store"),
        )
        copied[folder] = sum(1 for path in target.rglob("*") if path.is_file())

    return copied


def extract_results() -> list[dict]:
    section_c = SUPPLEMENTARY_ROOT / "sections" / "section-c.html"
    if not section_c.exists():
        return []

    node_script = r"""
const fs = require("fs");
const html = fs.readFileSync(process.argv[1], "utf8");
const match = html.match(/const RESULTS = (\[[\s\S]*?\]);/);
if (!match) {
  throw new Error("Could not locate RESULTS array in section-c.html");
}
const data = Function('"use strict"; return (' + match[1] + ');')();
process.stdout.write(JSON.stringify(data, null, 2));
"""
    proc = subprocess.run(
        ["node", "-e", node_script, str(section_c)],
        check=True,
        capture_output=True,
        text=True,
    )
    return json.loads(proc.stdout)


def source_video_path(kind: str, category: str, furniture: str, video_id: str) -> Path:
    source_dir = "keyframe_videos" if kind == "keyframe" else "trimmed_videos"
    return VIDEO_ROOT / source_dir / category / furniture / video_id / f"{video_id}.mp4"


def target_video_rel(kind: str, category: str, furniture: str, video_id: str) -> str:
    return f"{VIDEO_PUBLIC_BASE}/{kind}/{category}/{furniture}/{video_id}.mp4"


def target_video_path(kind: str, category: str, furniture: str, video_id: str) -> Path:
    return VIDEO_ASSET_ROOT / kind / category / furniture / f"{video_id}.mp4"


def prompt_candidates(q: dict, field: str, frame_idx=None) -> list[str]:
    names = []
    original = q.get(field)
    if original:
        names.append(original)
        stripped = re.sub(r"_q\d+(?=\.[^.]+$)", "", original)
        if stripped != original:
            names.append(stripped)

    prefix = "jumbled_prompt" if field.startswith("jumbled") else "prompt"
    if isinstance(frame_idx, int):
        names.append(f"{prefix}_{frame_idx:03d}.jpg")

    unique = []
    seen = set()
    for name in names:
        if name and name not in seen:
            seen.add(name)
            unique.append(name)
    return unique


def find_prompt_image(q: dict, candidates: list[str]) -> Path | None:
    fresh_prompt_dir = PROMPT_IMAGE_ROOT / q["vid_category"] / q["furniture_name"] / q["video_id"]
    for candidate in candidates:
        path = fresh_prompt_dir / candidate
        if path.exists():
            return path

    prompt_dir = (
        QUESTION_DATA_ROOT
        / q["template_type"]
        / "data"
        / q["vid_category"]
        / q["furniture_name"]
        / q["video_id"]
        / "prompt_images"
    )
    for candidate in candidates:
        path = prompt_dir / candidate
        if path.exists():
            return path
    return None


def build_prompt_manifest(questions: list[dict]) -> tuple[dict, dict]:
    question_entries = {}
    stats = Counter()
    copied_prompt_files = set()

    for q in questions:
        qid = q["qid_flat"]
        frame = q.get("frame_idx")
        specs = []

        if q.get("question_category") == "tracking":
            frame_a = frame[0] if isinstance(frame, list) and frame else None
            frame_b = frame[1] if isinstance(frame, list) and len(frame) > 1 else None
            fields = [
                ("Image A", "prompt_img_0_fn", frame_a),
                ("Image B", "jumbled_prompt_img_1_fn", frame_b),
            ]
        else:
            fields = [("Visual Prompt", "prompt_img_fn", frame if isinstance(frame, int) else None)]

        for label, field, field_frame in fields:
            candidates = prompt_candidates(q, field, field_frame)
            found = find_prompt_image(q, candidates)
            expected = q.get(field) or (candidates[0] if candidates else "")
            entry = {
                "label": label,
                "available": bool(found),
                "original": expected,
            }

            if found:
                rel = (
                    Path("assets")
                    / "prompt-images"
                    / q["template_type"]
                    / q["vid_category"]
                    / q["furniture_name"]
                    / q["video_id"]
                    / found.name
                )
                dest = ROOT / rel
                dest.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(found, dest)
                copied_prompt_files.add(rel.as_posix())
                entry["src"] = rel.as_posix()
                stats["available_prompt_images"] += 1
            else:
                entry["src"] = ""
                stats["missing_prompt_images"] += 1
            specs.append(entry)

        question_entries[qid] = specs

    stats["questions_with_any_prompt_image"] = sum(
        1 for specs in question_entries.values() if any(item["available"] for item in specs)
    )
    stats["questions_with_missing_prompt_image"] = sum(
        1 for specs in question_entries.values() if any(not item["available"] for item in specs)
    )
    stats["copied_prompt_files"] = len(copied_prompt_files)
    stats["fresh_prompt_source_exists"] = PROMPT_IMAGE_ROOT.exists()
    return question_entries, dict(stats)


def build_media_manifest(questions: list[dict]) -> dict:
    videos = {}
    for q in questions:
        key = f"{q['vid_category']}/{q['furniture_name']}/{q['video_id']}"
        if key in videos:
            continue
        videos[key] = {
            "video_id": q["video_id"],
            "category": q["vid_category"],
            "furniture": q["furniture_name"],
            "keyframe": target_video_rel("keyframe", q["vid_category"], q["furniture_name"], q["video_id"]),
            "trimmed": target_video_rel("trimmed", q["vid_category"], q["furniture_name"], q["video_id"]),
            "source_keyframe_exists": source_video_path("keyframe", q["vid_category"], q["furniture_name"], q["video_id"]).exists(),
            "source_trimmed_exists": source_video_path("trimmed", q["vid_category"], q["furniture_name"], q["video_id"]).exists(),
        }

    prompt_images, prompt_stats = build_prompt_manifest(questions)
    return {
        "videos": videos,
        "questionPromptImages": prompt_images,
        "stats": {
            "unique_videos": len(videos),
            "source_keyframe_videos": sum(1 for item in videos.values() if item["source_keyframe_exists"]),
            "source_trimmed_videos": sum(1 for item in videos.values() if item["source_trimmed_exists"]),
            **prompt_stats,
        },
    }


def config_scalar(config_text: str, key: str) -> str:
    match = re.search(rf"^\s*{re.escape(key)}:\s*(.+?)\s*$", config_text, flags=re.MULTILINE)
    if not match:
        return ""
    return match.group(1).strip().strip("'\"")


def prompt_label(media_setting: str) -> str:
    if media_setting.startswith("sep_"):
        return "Mixed-Media"
    if media_setting.startswith("concat_"):
        return "Concat"
    if media_setting.startswith("collage_"):
        return "Collage"
    return media_setting or "Unknown prompt"


def video_label(media_setting: str, config_text: str) -> str:
    if "trimmed_video" in media_setting or "trimmed_videos" in config_text:
        return "Trimmed"
    if "keyframe_video" in media_setting or "fps_1" in config_text:
        return "Key-frame"
    return "Video"


def normalize_model_response(response_payload) -> tuple[str, list[str], str]:
    if isinstance(response_payload, str):
        return response_payload, [], extract_answer(response_payload)
    if isinstance(response_payload, dict):
        raw = response_payload.get("response")
        if not isinstance(raw, str):
            raw = json.dumps(response_payload, ensure_ascii=True, indent=2)
        thoughts = response_payload.get("thoughts")
        return raw, thoughts if isinstance(thoughts, list) else [], extract_answer(raw)
    return "", [], ""


def extract_answer(text: str) -> str:
    match = re.search(r'"answer"\s*:\s*"([^"]+)"', str(text), flags=re.IGNORECASE)
    if match:
        return match.group(1).strip()
    match = re.search(r"\banswer\s*[:=]\s*([A-D])\b", str(text), flags=re.IGNORECASE)
    return match.group(1).strip().upper() if match else ""


def build_model_response_assets(questions: list[dict]) -> dict:
    question_by_qid = {q["qid_flat"]: q for q in questions}
    responses_by_question: dict[str, list[dict]] = defaultdict(list)
    models = []

    if not MODEL_RESPONSES_ROOT.exists():
        return {"models": [], "responsesByQuestion": {}, "stats": {"source_exists": False}}

    for model_dir in sorted(path for path in MODEL_RESPONSES_ROOT.iterdir() if path.is_dir()):
        responses_path = model_dir / "responses.jsonl"
        config_path = model_dir / "config.yaml"
        if not responses_path.exists():
            continue

        config_text = config_path.read_text(encoding="utf-8") if config_path.exists() else ""
        model_id = model_dir.name
        media_setting = config_scalar(config_text, "media_cache_dir").split("/")[-1] or model_id
        if "media_first" not in media_setting:
            media_setting = model_id
        model_name = config_scalar(config_text, "model_name")
        display_name = MODEL_DISPLAY_NAMES.get(model_id, model_name or model_id)
        prompt = prompt_label(media_setting)
        video = video_label(media_setting, config_text)
        setting_label = f"{prompt} / {video}"

        model_meta = {
            "id": model_id,
            "displayName": display_name,
            "modelName": model_name,
            "mediaSetting": media_setting,
            "prompt": prompt,
            "video": video,
            "settingLabel": setting_label,
        }
        models.append(model_meta)

        for row in read_jsonl(responses_path):
            qid = row.get("question", {}).get("qid_flat")
            question = question_by_qid.get(qid)
            if not question:
                continue
            raw, thoughts, extracted = normalize_model_response(row.get("response"))
            answer = row.get("post_processed_response") or extracted
            correct_answer = question.get("question", {}).get("correct_option", {}).get("label")
            responses_by_question[qid].append({
                "modelId": model_id,
                "model": display_name,
                "modelName": model_name,
                "mediaSetting": media_setting,
                "prompt": prompt,
                "video": video,
                "settingLabel": setting_label,
                "answer": answer,
                "correct": bool(correct_answer and answer == correct_answer),
                "raw": raw,
                "thoughts": thoughts,
            })

    model_order = {model["id"]: idx for idx, model in enumerate(models)}
    normalized = {
        qid: sorted(rows, key=lambda row: model_order.get(row["modelId"], 999))
        for qid, rows in sorted(responses_by_question.items())
    }
    return {
        "models": models,
        "responsesByQuestion": normalized,
        "stats": {
            "source_exists": True,
            "model_count": len(models),
            "question_count": len(normalized),
            "response_count": sum(len(rows) for rows in normalized.values()),
        },
    }


def build_data_assets() -> dict:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS.mkdir(parents=True, exist_ok=True)

    questions = read_json(ROOT / "questions.json")
    write_json(DATA_DIR / "questions.json", questions)

    category_counts = Counter(q["question_category"] for q in questions)
    template_counts = Counter(q["template_type"] for q in questions)
    furniture_counts = Counter(q["furniture_name"] for q in questions)
    videos_by_category = defaultdict(set)
    for q in questions:
        videos_by_category[q["vid_category"]].add(q["video_id"])

    stats = {
        "question_count": len(questions),
        "unique_video_count": len({(q["vid_category"], q["furniture_name"], q["video_id"]) for q in questions}),
        "category_counts": dict(sorted(category_counts.items())),
        "category_labels": CATEGORY_LABELS,
        "template_counts": dict(sorted(template_counts.items())),
        "furniture_count": len(furniture_counts),
        "video_counts_by_category": {k: len(v) for k, v in sorted(videos_by_category.items())},
    }
    write_json(DATA_DIR / "dataset-stats.json", stats)

    write_json(DATA_DIR / "example-responses.json", read_jsonl(SUPPLEMENTARY_ROOT / "assets" / "compiled_responses.jsonl"))
    write_json(DATA_DIR / "visual-prompt-examples.json", read_jsonl(SUPPLEMENTARY_ROOT / "assets" / "sectionb" / "compiled_responses.jsonl"))
    write_json(DATA_DIR / "self-explanation-examples.json", read_jsonl(SUPPLEMENTARY_ROOT / "assets" / "sectiond_1" / "self_explain_compiled_responses.jsonl"))
    write_json(DATA_DIR / "tva-examples.json", read_jsonl(SUPPLEMENTARY_ROOT / "assets" / "sectiond" / "compiled_responses.jsonl"))
    write_json(DATA_DIR / "results.json", extract_results())
    write_json(DATA_DIR / "media-manifest.json", build_media_manifest(questions))
    model_responses = build_model_response_assets(questions)
    write_json(DATA_DIR / "model-responses.json", model_responses)

    pdfs = {
        "paper": copy_if_exists(PAPER_PDF, ASSETS / "flat_pack_bench_arxiv.pdf"),
        "supplementary": copy_if_exists(SUPPLEMENTARY_PDF, ASSETS / "flat_pack_bench_cvpr_2026_submission_supplementary.pdf"),
    }
    supplementary_assets = copy_supplementary_media()

    return {
        "questions": len(questions),
        "stats": stats,
        "pdfs": pdfs,
        "model_responses": model_responses.get("stats", {}),
        "supplementary_assets": supplementary_assets,
    }


def transcode_video(source: Path, target: Path, kind: str, force: bool = False) -> bool:
    if not source.exists():
        return False
    if target.exists() and target.stat().st_size > 0 and not force:
        return False

    target.parent.mkdir(parents=True, exist_ok=True)
    filters = "scale=480:-2"
    if kind == "trimmed":
        filters = "scale=480:-2,fps=10"

    cmd = [
        "ffmpeg",
        "-nostdin",
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-vf",
        filters,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "32",
        "-movflags",
        "+faststart",
        str(target),
    ]
    subprocess.run(cmd, check=True)
    return True


def build_video_assets(force: bool = False) -> dict:
    questions = read_json(DATA_DIR / "questions.json") if (DATA_DIR / "questions.json").exists() else read_json(ROOT / "questions.json")
    unique = sorted({(q["vid_category"], q["furniture_name"], q["video_id"]) for q in questions})
    counts = Counter()

    for idx, (category, furniture, video_id) in enumerate(unique, start=1):
        for kind in ("keyframe", "trimmed"):
            source = source_video_path(kind, category, furniture, video_id)
            try:
                target = target_video_path(kind, category, furniture, video_id)
                encoded = transcode_video(source, target, kind, force=force)
            except subprocess.CalledProcessError as exc:
                counts[f"{kind}_failed"] += 1
                print(f"[{idx}/{len(unique)}] failed {kind}: {category}/{furniture}/{video_id}: {exc}", flush=True)
                continue

            if encoded:
                counts[f"{kind}_encoded"] += 1
                size_mb = target.stat().st_size / (1024 * 1024)
                print(f"[{idx}/{len(unique)}] encoded {kind}: {category}/{furniture}/{video_id} ({size_mb:.2f} MB)", flush=True)
            elif target.exists():
                counts[f"{kind}_skipped_existing"] += 1
            else:
                counts[f"{kind}_missing_source"] += 1
                print(f"[{idx}/{len(unique)}] missing {kind}: {category}/{furniture}/{video_id}", flush=True)

    return dict(counts)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", action="store_true", help="build JSON/PDF/supplementary assets")
    parser.add_argument("--videos", action="store_true", help="transcode dataset videos into the videos repo assets/videos tree")
    parser.add_argument("--force", action="store_true", help="overwrite existing transcoded videos")
    args = parser.parse_args()

    if not args.data and not args.videos:
        args.data = True
        args.videos = True

    summary = {}
    if args.data:
        summary["data"] = build_data_assets()
    if args.videos:
        summary["videos"] = build_video_assets(force=args.force)

    print(json.dumps(summary, indent=2, ensure_ascii=True))


if __name__ == "__main__":
    main()
