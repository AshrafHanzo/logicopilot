"""Extraction engine — pulls configured field values out of an UNSEEN document.

At configure-time (the wizard) each field got a both-mode profile: a list of caption
variations + a semantic description + an extraction prompt. At run-time (a Job) the
operator uploads a real document whose layout/captions may differ. We OCR it once, then
ask OpenAI to read the field values out of that OCR text using the per-field prompts —
so a value captioned "Waybill No" on the new doc is still found for a field the admin
marked next to "Seaway Bill of Lading No".

One OpenAI call per document (all its fields batched) keeps it cheap and coherent.
"""

import base64
import json
import logging
import re
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger(__name__)

MAX_VISION_PAGES = 6


def _normalize(value: str | None) -> str:
    """Case/space/punctuation-insensitive form for comparison."""
    if value is None:
        return ""
    return re.sub(r"[^a-z0-9]", "", value.lower())


def _tokens(value: str | None) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", (value or "").lower()))


def _is_numeric_value(value: str | None) -> bool:
    """True when the value is dominated by digits — weights, prices, counts, IDs —
    as opposed to a name/address that merely contains a number."""
    alnum = _normalize(value)
    if not alnum:
        return False
    digits = sum(c.isdigit() for c in alnum)
    return digits / len(alnum) >= 0.5


def _numbers(value: str | None) -> list[float | str]:
    raw = re.findall(r"\d+(?:\.\d+)?", (value or "").replace(",", ""))
    out: list[float | str] = []
    for x in raw:
        try:
            out.append(float(x))
        except ValueError:
            out.append(x)
    return sorted(out, key=str)


def compare_values(a: str | None, b: str | None) -> str:
    """Returns one of: 'missing' | 'match' | 'review' | 'mismatch'.
    - missing:  the field is absent on one/both documents (nothing to compare);
    - match:    identical (ignoring case/format) or numeric-equal or clearly the same text;
    - review:   text is *almost* the same — operator decides whether to accept;
    - mismatch: numeric values differ, or the text is clearly different.
    """
    na, nb = _normalize(a), _normalize(b)
    if not na or not nb:
        return "missing"
    if na == nb:
        return "match"

    # Numeric fields → strict: any differing digit is a mismatch.
    if _is_numeric_value(a) and _is_numeric_value(b):
        return "match" if _numbers(a) == _numbers(b) else "mismatch"

    # Text fields → graded by word overlap.
    if na in nb or nb in na:
        return "match"
    ta, tb = _tokens(a), _tokens(b)
    if not ta or not tb:
        return "mismatch"
    overlap = len(ta & tb) / len(ta | tb)  # Jaccard on words
    if overlap >= 0.8:
        return "match"
    if overlap >= 0.5:
        return "review"  # almost similar — let the operator accept or not
    return "mismatch"


def values_match(a: str | None, b: str | None) -> bool:
    return compare_values(a, b) == "match"


def extract_document_fields(ocr_text: str, fields: list[dict]) -> dict[str, str | None]:
    """fields: [{"label": str, "prompt": str, "variations": [str], "description": str}]
    Returns {label: value_or_None}. Falls back to all-None if OpenAI is unavailable."""
    settings = get_settings()
    labels = [f["label"] for f in fields]
    if not settings.openai_api_key or not fields:
        return {label: None for label in labels}

    field_lines = []
    for f in fields:
        variations = ", ".join(f.get("variations") or []) or "(none)"
        field_lines.append(
            f'- "{f["label"]}": {f.get("prompt") or f.get("description") or ""} '
            f"(may be captioned as: {variations})"
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=45)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            max_tokens=800,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You extract structured fields from a document's raw OCR text. "
                        "Different documents caption the same field differently — match by "
                        "meaning and by the listed caption variations. Return a JSON object "
                        "mapping each requested field name to the raw value found (string). "
                        "Return null when the field is NOT clearly present on THIS document — "
                        "do NOT guess, and do NOT return unrelated nearby text just to fill it. "
                        "Return ONLY the value, no captions or units unless the instruction says otherwise."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        "Fields to extract:\n"
                        + "\n".join(field_lines)
                        + "\n\nReturn a JSON object keyed by exactly these field names: "
                        + ", ".join(labels)
                        + "\n\n--- OCR TEXT ---\n"
                        + ocr_text[:12000]
                    ),
                },
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        out: dict[str, str | None] = {}
        for label in labels:
            val = data.get(label)
            out[label] = None if val in (None, "", "null") else str(val)
        return out
    except Exception as exc:  # noqa: BLE001 — degrade to all-None on any failure
        logger.warning("Extraction failed: %s", exc)
        return {label: None for label in labels}


def _field_lines(fields: list[dict]) -> list[str]:
    lines = []
    for f in fields:
        variations = ", ".join(f.get("variations") or []) or "(none)"
        lines.append(
            f'- "{f["label"]}": {f.get("prompt") or f.get("description") or ""} '
            f"(may be captioned as: {variations})"
        )
    return lines


def extract_document_fields_from_images(image_paths: list[Path], fields: list[dict]) -> dict[str, str | None]:
    """Vision fallback — read the field values straight from the page images with OpenAI
    when OCR (Document AI) is unavailable. Same contract as extract_document_fields."""
    settings = get_settings()
    labels = [f["label"] for f in fields]
    if not settings.openai_api_key or not fields or not image_paths:
        return {label: None for label in labels}

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=90)
        content: list[dict] = [
            {
                "type": "text",
                "text": (
                    "Read this document's page image(s) and extract these fields. Different "
                    "documents caption the same field differently — match by meaning and the "
                    "listed caption variations. Return ONLY the raw value per field. Return "
                    "null when the field is NOT clearly present on THIS document — do NOT guess "
                    "or return unrelated nearby text just to fill it.\n\nFields:\n"
                    + "\n".join(_field_lines(fields))
                    + "\n\nReturn a JSON object keyed by exactly these field names: "
                    + ", ".join(labels)
                ),
            }
        ]
        for path in image_paths[:MAX_VISION_PAGES]:
            b64 = base64.b64encode(path.read_bytes()).decode()
            content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b64}"}})

        resp = client.chat.completions.create(
            model=settings.openai_model,
            max_tokens=900,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": content}],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        out: dict[str, str | None] = {}
        for label in labels:
            val = data.get(label)
            out[label] = None if val in (None, "", "null") else str(val)
        return out
    except Exception as exc:  # noqa: BLE001
        logger.warning("Vision extraction failed: %s", exc)
        return {label: None for label in labels}
