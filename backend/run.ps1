# Runs the backend without depending on `uv` being on PATH yet (e.g. if you haven't
# restarted your terminal since uv was installed). Once `uv` is on PATH normally,
# `uv run python -m app.main` works too and this script becomes optional.
$uv = "C:\Users\abcom\AppData\Roaming\Python\Python312\Scripts\uv.exe"
& $uv run python -m app.main
