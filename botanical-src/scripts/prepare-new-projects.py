"""Stage the two approved PDFs, preserving original encoded streams.

Philippines pages are placed uniformly on the same physical landscape canvas
using a PDF Form XObject. Its original content/image/font streams remain byte
identical; only a small outer coordinate transform is new. The poster is copied
verbatim. Source files and the shared public symlink are never modified.
"""
from collections import Counter
from hashlib import sha256
import json
from math import ceil
from pathlib import Path
import shutil

import fitz
from pypdf import PdfReader, PdfWriter
from pypdf.generic import (
    ArrayObject, DictionaryObject, IndirectObject, StreamObject,
    DecodedStreamObject, NameObject, NumberObject, RectangleObject,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path('/Users/hui/Documents/SJTU/TUM-4th_semester/ASLA/素材文件/最终图纸-5.11/15092- Analysis and Planning - A Circular Floodplain-Linking Plastic Recovery-Water Adaptation-and Community Life')
STAGE = ROOT / 'project-assets'
ASSETS = STAGE / 'assets'
QA = ROOT / 'tmp/new-projects-assets'
ASSETS.mkdir(parents=True, exist_ok=True)
QA.mkdir(parents=True, exist_ok=True)


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def streams(page):
    """Count raw encoded PDF streams, including all image and font resources."""
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
                if key not in ('/Parent', '/P'):
                    visit(item)
        elif isinstance(value, (ArrayObject, list, tuple)):
            for item in value:
                visit(item)
    visit(page)
    return found


def geometry(page):
    return {'mediaBox': list(map(float, page.mediabox)),
            'cropBox': list(map(float, page.cropbox)),
            'rotation': page.rotation}


def normalize(source, destination):
    reader, writer = PdfReader(source), PdfWriter()
    before = digest(source)
    target_width = max(float(page.cropbox.width) for page in reader.pages)
    target_height = max(float(page.cropbox.height) for page in reader.pages)
    audit = []
    for index, original in enumerate(reader.pages, 1):
        assert original.rotation == 0, 'Source rotation requires explicit normalization.'
        assert float(original.get('/UserUnit', 1)) == 1
        contents = original['/Contents']
        assert isinstance(contents, StreamObject), 'Expected one encoded source stream.'
        # Clone, rather than decode/re-encode, the existing stream. Form resources
        # are cloned into the same writer so every referenced raw stream survives.
        form = contents.clone(writer)
        form[NameObject('/Type')] = NameObject('/XObject')
        form[NameObject('/Subtype')] = NameObject('/Form')
        form[NameObject('/FormType')] = NumberObject(1)
        form[NameObject('/BBox')] = RectangleObject(original.cropbox)
        form[NameObject('/Resources')] = original['/Resources'].clone(writer)
        if '/Group' in original:
            form[NameObject('/Group')] = original['/Group'].clone(writer)
        form_ref = form.indirect_reference or writer._add_object(form)
        page = writer.add_blank_page(target_width, target_height)
        page.cropbox = RectangleObject([0, 0, target_width, target_height])
        page[NameObject('/Resources')] = DictionaryObject({
            NameObject('/XObject'): DictionaryObject({NameObject('/SourcePage'): form_ref})
        })
        width, height = float(original.cropbox.width), float(original.cropbox.height)
        scale = min(target_width / width, target_height / height)
        tx = (target_width-width*scale)/2 - float(original.cropbox.left)*scale
        ty = (target_height-height*scale)/2 - float(original.cropbox.bottom)*scale
        wrapper = DecodedStreamObject()
        wrapper.set_data(f'q\n{scale:.12f} 0 0 {scale:.12f} {tx:.12f} {ty:.12f} cm\n/SourcePage Do\nQ\n'.encode('ascii'))
        page[NameObject('/Contents')] = writer._add_object(wrapper)
        assert not original.get('/Annots'), 'Source annotation requires coordinate transfer.'
        audit.append({'page': index, 'original': geometry(original),
                      'scale': scale, 'translate': [tx, ty]})
    writer.add_metadata({'/Title': 'A Circular Floodplain',
                         '/Subject': 'Uniform page canvas; original artwork streams preserved'})
    writer.write(destination)
    normalized = PdfReader(destination)
    for original, output, record in zip(reader.pages, normalized.pages, audit):
        expected, actual = streams(original), streams(output)
        assert not (expected-actual), f"Source stream changed on page {record['page']}"
        assert len(actual-expected) == 1, 'Only the outer placement stream may be new.'
        record['normalized'] = geometry(output)
        record['originalEncodedStreamsRetained'] = True
        record['originalStreamCount'] = sum(expected.values())
    assert len({tuple(page.mediabox) for page in normalized.pages}) == 1
    assert len({tuple(page.cropbox) for page in normalized.pages}) == 1
    assert digest(source) == before, 'Original source file mutated.'
    return {'source': str(source), 'sourceSha256Before': before,
            'sourceSha256After': digest(source), 'originalUnchanged': True,
            'output': str(destination), 'outputSha256': digest(destination),
            'normalization': 'uniform PDF-coordinate scale and centered placement; no cropping, rasterization or image recompression',
            'commonSizePoints': [target_width, target_height], 'pages': audit}


def split(source, slug):
    source_hash = digest(source)
    folder = ASSETS / 'pdf-pages' / f'{slug}-{source_hash[:8]}'
    folder.mkdir(parents=True, exist_ok=True)
    reader, urls, sizes = PdfReader(source), [], []
    for index, original in enumerate(reader.pages, 1):
        destination = folder / f'page-{index:02}.pdf'
        writer = PdfWriter()
        writer.add_page(original)
        writer.write(destination)
        copied = PdfReader(destination).pages[0]
        assert geometry(original) == geometry(copied)
        assert streams(original) == streams(copied), f'Single-page extraction altered a stream: {destination}'
        urls.append('/' + str(destination.relative_to(STAGE)))
        sizes.append(destination.stat().st_size)
    return {'sourceSha256': source_hash, 'pages': urls}, {
        'source': str(source), 'pages': len(urls), 'allEncodedStreamsIdentical': True,
        'firstPageBytes': sizes[0], 'totalPageBytes': sum(sizes), 'originalBytes': source.stat().st_size}


def cover(source, name, width=2000):
    document = fitz.open(source)
    page = document[0]
    pix = page.get_pixmap(matrix=fitz.Matrix(width/page.rect.width, width/page.rect.width), alpha=False)
    output = ASSETS / name
    pix.save(output)
    return {'file': str(output), 'width': pix.width, 'height': pix.height,
            'format': 'lossless PNG preview; source PDF unchanged'}


def contact_sheet(source):
    document = fitz.open(source)
    columns, cell_width, cell_height, margin = 3, 520, 300, 20
    rows = ceil(len(document)/columns)
    sheet = fitz.open()
    out = sheet.new_page(width=columns*cell_width, height=rows*cell_height)
    for index, page in enumerate(document):
        x, y = (index % columns)*cell_width, (index//columns)*cell_height
        pix = page.get_pixmap(matrix=fitz.Matrix(1,1).prescale((cell_width-2*margin)/page.rect.width, (cell_width-2*margin)/page.rect.width), alpha=False)
        out.insert_text((x+margin, y+20), f'{index+1:02} / normalized canvas', fontsize=11, color=(.1,.15,.22))
        area = fitz.Rect(x+margin, y+36, x+cell_width-margin, y+cell_height-16)
        out.insert_image(area, pixmap=pix, keep_proportion=True)
        out.draw_rect(area, color=(.7,.75,.8), width=.5)
    target = QA / 'philippines-normalized-contact-sheet.png'
    out.get_pixmap(matrix=fitz.Matrix(1,1), alpha=False).save(target)
    return str(target)


philippines = ASSETS / 'project_philippines.pdf'
poster = ASSETS / 'project_babylm_poster.pdf'
normalization = normalize(SOURCE / '项目图纸-hy.pdf', philippines)
poster_before = digest(SOURCE / 'poster - 15_副本.pdf')
shutil.copyfile(SOURCE / 'poster - 15_副本.pdf', poster)
assert digest(poster) == poster_before == digest(SOURCE / 'poster - 15_副本.pdf')
manifest, page_audit = {}, []
for source, slug in ((philippines, 'philippines'), (poster, 'babylm-poster')):
    entry, audit = split(source, slug)
    manifest[f'/assets/{source.name}'] = entry
    page_audit.append(audit)
(STAGE / 'new-pdf-pages.json').write_text(json.dumps(manifest, indent=2)+'\n')
report = {'philippines': normalization,
          'poster': {'source': str(SOURCE / 'poster - 15_副本.pdf'),
                     'sourceSha256Before': poster_before,
                     'sourceSha256After': digest(SOURCE / 'poster - 15_副本.pdf'),
                     'copySha256': digest(poster), 'exactCopy': True,
                     'geometry': geometry(PdfReader(poster).pages[0])},
          'lazyPages': page_audit,
          'covers': [cover(philippines, 'philippines-cover.png'), cover(poster, 'babylm-poster-cover.png')],
          'contactSheet': contact_sheet(philippines),
          'publishedFiles': ['project_philippines.pdf', 'project_babylm_poster.pdf'],
          'unrequestedPaperCopied': False}
(QA / 'quality-and-size-audit.json').write_text(json.dumps(report, indent=2)+'\n')
print(json.dumps({'commonSizePoints': normalization['commonSizePoints'],
                  'pages': len(normalization['pages']), 'sourcesUnchanged': True,
                  'covers': report['covers'], 'lazyPages': page_audit,
                  'contactSheet': report['contactSheet']}, indent=2))
