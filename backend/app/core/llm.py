"""OpenAI service — generates the tailored extraction prompt for a cropped field.

Per the spec (implementation_plan.md, Step 4): the anchor term detected near a
crop plus its coordinate metadata are combined into a system prompt for that
field. OpenAI writes a crisp instruction; if the API is unreachable we fall back
to a deterministic local template so cropping never hard-fails on network.
"""

import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


def _fallback_prompt(field_name: str, anchor_term: str | None, value_text: str | None,
                     page_number: int) -> str:
    anchor_part = (
        f' It appears next to the label text "{anchor_term}".' if anchor_term else ""
    )
    example_part = (
        f' Example value from the reference document: "{value_text}".' if value_text else ""
    )
    return (
        f'Extract the value for the field "{field_name}" from page {page_number} of the '
        f"document.{anchor_part}{example_part} Return only the value itself with no "
        f"surrounding label text, punctuation, or explanation."
    )


def generate_field_prompt(field_name: str, anchor_term: str | None, value_text: str | None,
                          page_number: int) -> str:
    fallback = _fallback_prompt(field_name, anchor_term, value_text, page_number)
    if not settings.OPENAI_API_KEY:
        return fallback
    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY, timeout=20)
        resp = client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            max_tokens=200,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You write extraction instructions for a document-AI pipeline. "
                        "Given a field name, the label text found near it on the page "
                        "(the 'anchor'), and an example value, write ONE concise "
                        "instruction telling an LLM how to find and return that field's "
                        "value from OCR text. The instruction must demand returning only "
                        "the raw value. Reply with the instruction only."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Field name: {field_name}\n"
                        f"Anchor label near the value: {anchor_term or '(none detected)'}\n"
                        f"Example value: {value_text or '(unreadable)'}\n"
                        f"Page: {page_number}"
                    ),
                },
            ],
        )
        text = (resp.choices[0].message.content or "").strip()
        return text or fallback
    except Exception as exc:  # noqa: BLE001 — any API failure degrades to fallback
        logger.warning("OpenAI prompt generation failed, using fallback: %s", exc)
        return fallback
