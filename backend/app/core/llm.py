"""OpenAI service — turns a single marked field into a robust extraction profile.

The Super Admin marks ONE region on ONE sample document and names it (e.g. marks
"Seaway Bill of Lading No" and calls it `bl_number`). But real documents label the
same value many ways: "Seaway Bill No", "Waybill No", "B/L No", or just "No". So
from that one mark we generate a *profile* that generalizes:

- anchor_variations:    every caption the field realistically appears under
- semantic_description: what the value means (for the semantic fallback at extraction)
- value_format_hint:    the expected shape of the value
- extraction_prompt:    the assembled instruction

If OpenAI is unreachable we fall back to a deterministic local profile so marking
never hard-fails on the network.
"""

import json
import logging
from dataclasses import dataclass

from app.core.config import get_settings

logger = logging.getLogger(__name__)


@dataclass
class FieldProfile:
    anchor_variations: list[str]
    semantic_description: str
    value_format_hint: str
    extraction_prompt: str


def _fallback(field_name: str, anchor: str | None, value: str | None) -> FieldProfile:
    variations = [v for v in {anchor, field_name.replace("_", " ")} if v]
    anchor_line = f' It usually appears next to a caption like "{anchor}".' if anchor else ""
    value_line = f' In the reference document the value was "{value}".' if value else ""
    return FieldProfile(
        anchor_variations=variations,
        semantic_description=f'The document field "{field_name}".',
        value_format_hint=value or "",
        extraction_prompt=(
            f'Find the value for "{field_name}".{anchor_line}{value_line} '
            f"Different documents may label it differently, so match by meaning as well as "
            f"by caption. Return only the raw value, with no caption text or explanation."
        ),
    )


def build_field_profile(
    field_name: str,
    anchor_term: str | None,
    value_text: str | None,
    document_type: str,
    correction_prompt: str | None = None,
) -> FieldProfile:
    """Generate the extraction profile for a marked field. `correction_prompt` (from the
    training loop) is folded in as an extra instruction when present."""
    settings = get_settings()
    fallback = _fallback(field_name, anchor_term, value_text)
    if not settings.openai_api_key:
        return fallback

    correction_line = (
        f"\nA human reviewer added this correction guidance: {correction_prompt}"
        if correction_prompt
        else ""
    )
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.openai_api_key, timeout=30)
        resp = client.chat.completions.create(
            model=settings.openai_model,
            max_tokens=400,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You configure a document-extraction pipeline. Given a field the user "
                        "marked on a sample document, return a JSON object that lets the pipeline "
                        "find that same field on OTHER documents that may caption it differently. "
                        "Keys: "
                        '"anchor_variations" (array of the caption/label strings this field '
                        "commonly appears under across real-world documents of this type — be "
                        "thorough, include abbreviations and synonyms), "
                        '"semantic_description" (one sentence: what the value means), '
                        '"value_format_hint" (the typical shape/format of the value), '
                        '"extraction_prompt" (one instruction telling an LLM how to locate and '
                        "return ONLY the raw value, matching by meaning when no known caption "
                        "appears). Reply with the JSON object only."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Document type: {document_type}\n"
                        f"Field name: {field_name}\n"
                        f"Caption I marked it next to: {anchor_term or '(none detected)'}\n"
                        f"Example value I marked: {value_text or '(unreadable)'}"
                        f"{correction_line}"
                    ),
                },
            ],
        )
        data = json.loads(resp.choices[0].message.content or "{}")
        variations = data.get("anchor_variations") or fallback.anchor_variations
        if isinstance(variations, str):
            variations = [variations]
        # Always keep the actually-observed caption in the list.
        if anchor_term and anchor_term not in variations:
            variations = [anchor_term, *variations]
        return FieldProfile(
            anchor_variations=[str(v) for v in variations],
            semantic_description=data.get("semantic_description") or fallback.semantic_description,
            value_format_hint=data.get("value_format_hint") or fallback.value_format_hint,
            extraction_prompt=data.get("extraction_prompt") or fallback.extraction_prompt,
        )
    except Exception as exc:  # noqa: BLE001 — any API/parse failure degrades to fallback
        logger.warning("OpenAI profile generation failed, using fallback: %s", exc)
        return fallback
