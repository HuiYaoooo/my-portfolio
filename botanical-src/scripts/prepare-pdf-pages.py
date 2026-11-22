"""Copy each portfolio page into its own PDF without re-encoding any stream.

The original PDFs remain the download sources. This generates the lazy reader
assets and a manifest; no rasterization, image resampling or font conversion.
Run with Python 3 and pypdf before building when the original PDFs change.
"""
from collections import Counter
from hashlib import sha256
import json
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, IndirectObject, StreamObject

ROOT = Path(__file__).resolve().parents[1]
SOURCE = next((root for root in (ROOT.parent / "assets", ROOT.parents[1] / "portfolio-site/assets")
               if (root / "project_urban_wildlife.pdf").exists()), None)
if SOURCE is None:
    raise SystemExit("The existing original portfolio PDFs are required.")


def streams(page):
    """Fingerprint all encoded content, image, mask and embedded-font streams."""
    found, seen = Counter(), set()

    def visit(value):
        if isinstance(value, IndirectObject):
            key = (id(value.pdf), value.idnum, value.generation)
            if key in seen:
                return
            seen.add(key)
            value = value.get_object()
        if isinstance(value, StreamObject):
            found[sha256(value._data).hexdigest()] += 1
        if isinstance(value, DictionaryObject):
            for key, item in value.items():
                if key not in ("/Parent", "/P"):
                    visit(item)
        elif isinstance(value, (ArrayObject, list, tuple)):
            for item in value:
                visit(item)
    visit(page)
    return found


manifest, report = {}, []
for slug, filename in (("urban", "project_urban_wildlife.pdf"), ("hihi", "project_hihi_friends.pdf")):
    original = SOURCE / filename
    digest = sha256(original.read_bytes()).hexdigest()
    folder = ROOT / "public/assets/pdf-pages" / f"{slug}-{digest[:8]}"
    folder.mkdir(parents=True, exist_ok=True)
    reader = PdfReader(original)
    urls, sizes = [], []
    for number, page in enumerate(reader.pages, start=1):
        destination = folder / f"page-{number:02}.pdf"
        writer = PdfWriter()
        writer.add_page(page)
        writer.write(destination)
        copied = PdfReader(destination).pages[0]
        assert page.mediabox == copied.mediabox, f"Page geometry changed: {destination}"
        assert page.cropbox == copied.cropbox, f"Page crop changed: {destination}"
        assert page.rotation == copied.rotation, f"Page rotation changed: {destination}"
        assert streams(page) == streams(copied), f"Encoded source streams changed: {destination}"
        urls.append("/" + str(destination.relative_to(ROOT / "public")))
        sizes.append(destination.stat().st_size)
    manifest[f"/assets/{filename}"] = {"sourceSha256": digest, "pages": urls}
    report.append({"source": filename, "originalBytes": original.stat().st_size,
                   "pageCount": len(urls), "firstPageBytes": sizes[0],
                   "allPagesBytes": sum(sizes), "allEncodedStreamsIdentical": True})

(ROOT / "src/content/pdf-pages.json").write_text(json.dumps(manifest, indent=2) + "\n")
(ROOT / "qa").mkdir(exist_ok=True)
(ROOT / "qa/lossless-pdf-pages.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
