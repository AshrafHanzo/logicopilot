"""Google Cloud Document AI OCR service.

Strategy: OCR each rendered template page ONCE with Document AI, cache the
result (full text + word tokens with normalized bounding boxes) as JSON next to
the page image. Anchor detection for any number of crops on that page is then a
purely geometric lookup against the cached tokens — no repeat API calls.
"""

import json
import logging
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None


def _get_client():
    global _client
    if _client is None:
        from google.api_core.client_options import ClientOptions
        from google.cloud import documentai

        opts = ClientOptions(api_endpoint=f"{settings.DOCAI_LOCATION}-documentai.googleapis.com")
        _client = documentai.DocumentProcessorServiceClient(client_options=opts)
    return _client


def _layout_text(layout, full_text: str) -> str:
    parts = []
    for seg in layout.text_anchor.text_segments:
        parts.append(full_text[int(seg.start_index): int(seg.end_index)])
    return "".join(parts)


def ocr_page_image(image_path: Path) -> dict:
    """OCR one page image. Returns {"text": str, "tokens": [{text, x0, y0, x1, y1}]}
    with coordinates normalized 0-1 (same space as FieldMapping boxes)."""
    from google.cloud import documentai

    client = _get_client()
    name = client.processor_path(
        settings.DOCAI_PROJECT_ID, settings.DOCAI_LOCATION, settings.DOCAI_PROCESSOR_ID
    )
    raw = documentai.RawDocument(content=image_path.read_bytes(), mime_type="image/png")
    result = client.process_document(
        request=documentai.ProcessRequest(name=name, raw_document=raw)
    )
    doc = result.document

    tokens = []
    for page in doc.pages:
        for token in page.tokens:
            text = _layout_text(token.layout, doc.text).strip()
            if not text:
                continue
            verts = token.layout.bounding_poly.normalized_vertices
            xs = [v.x for v in verts]
            ys = [v.y for v in verts]
            if not xs or not ys:
                continue
            tokens.append(
                {"text": text, "x0": min(xs), "y0": min(ys), "x1": max(xs), "y1": max(ys)}
            )
    return {"text": doc.text, "tokens": tokens}


def get_page_ocr(template_dir: Path, page_number: int) -> dict:
    """Cached OCR for a rendered template page (one Document AI call per page, ever)."""
    cache_file = template_dir / "ocr" / f"page_{page_number}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text(encoding="utf-8"))

    image_path = template_dir / "pages" / f"page_{page_number}.png"
    if not image_path.exists():
        raise FileNotFoundError(f"Rendered page image not found: {image_path}")

    data = ocr_page_image(image_path)
    cache_file.parent.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(data), encoding="utf-8")
    logger.info("Document AI OCR cached for %s (%d tokens)", image_path.name, len(data["tokens"]))
    return data
