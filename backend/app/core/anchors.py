"""Geometric anchor detection over cached Document AI tokens.

Given a page's OCR tokens (normalized 0-1 coords) and a crop box, find:
- value_text:  the OCR text inside the box (the example value the admin marked)
- anchor_term: the nearest label-like text just LEFT of or ABOVE the box
Pure geometry — no API calls.
"""

LEFT_SEARCH_WIDTH = 0.30
ABOVE_SEARCH_FACTOR = 3.0
ABOVE_SEARCH_MIN = 0.06
LINE_GROUP_TOLERANCE = 0.012


def _center(t: dict) -> tuple[float, float]:
    return ((t["x0"] + t["x1"]) / 2, (t["y0"] + t["y1"]) / 2)


def _tokens_inside(tokens: list[dict], box: dict) -> list[dict]:
    out = []
    for t in tokens:
        cx, cy = _center(t)
        if box["x0"] <= cx <= box["x1"] and box["y0"] <= cy <= box["y1"]:
            out.append(t)
    return out


def _join_line(tokens: list[dict]) -> str:
    return " ".join(t["text"] for t in sorted(tokens, key=lambda t: t["x0"]))


def _group_into_lines(tokens: list[dict]) -> list[list[dict]]:
    lines: list[list[dict]] = []
    for token in sorted(tokens, key=lambda t: _center(t)[1]):
        cy = _center(token)[1]
        placed = False
        for line in lines:
            line_cy = sum(_center(t)[1] for t in line) / len(line)
            if abs(cy - line_cy) <= LINE_GROUP_TOLERANCE:
                line.append(token)
                placed = True
                break
        if not placed:
            lines.append([token])
    return lines


def detect_value_and_anchor(ocr: dict, box: dict) -> tuple[str | None, str | None]:
    """Returns (value_text, anchor_term) for a crop box against a page's OCR tokens."""
    tokens = ocr.get("tokens", [])
    if not tokens:
        return None, None

    inside = _tokens_inside(tokens, box)
    value_text = _join_line(inside) if inside else None
    inside_ids = {id(t) for t in inside}

    box_height = box["y1"] - box["y0"]
    above_range = max(ABOVE_SEARCH_FACTOR * box_height, ABOVE_SEARCH_MIN)

    left, above = [], []
    for t in tokens:
        if id(t) in inside_ids:
            continue
        cx, cy = _center(t)
        if (
            t["x1"] <= box["x0"] + 0.005
            and box["x0"] - t["x1"] <= LEFT_SEARCH_WIDTH
            and box["y0"] - 0.01 <= cy <= box["y1"] + 0.01
        ):
            left.append(t)
        elif (
            t["y1"] <= box["y0"] + 0.005
            and box["y0"] - t["y1"] <= above_range
            and box["x0"] - 0.10 <= cx <= box["x1"] + 0.10
        ):
            above.append(t)

    anchor_term = None
    if left:
        lines = _group_into_lines(left)
        best = min(lines, key=lambda line: box["x0"] - max(t["x1"] for t in line))
        anchor_term = _join_line(best)
    elif above:
        lines = _group_into_lines(above)
        best = min(lines, key=lambda line: box["y0"] - max(t["y1"] for t in line))
        anchor_term = _join_line(best)

    if anchor_term:
        anchor_term = anchor_term.strip().rstrip(":").strip() or None

    return value_text, anchor_term
