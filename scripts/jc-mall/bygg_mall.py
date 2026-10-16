"""
Bygger src/assets/jc-mall.pptx: ett skelett för journal club-presentationer på
SÖS officiella PowerPoint-mall. Mallens bakgrunder, typsnitt, färger och logga
behålls; exempelsidorna tas bort och åtta sidor läggs till från mallens egna
layouter. Texten är markörer som {{TITEL}} som appen fyller i
(src/lib/jc-pptx.ts). En markör som ensam utgör ett stycke ersätts av ett
eller flera stycken med samma formatering.

Kör: python3 scripts/jc-mall/bygg_mall.py <SÖS-mall.pptx> src/assets/jc-mall.pptx
Kräver python-pptx.
"""
import copy
import sys

from lxml import etree
from pptx import Presentation
from pptx.oxml.ns import qn
from pptx.util import Emu, Inches, Pt

SRC, OUT = sys.argv[1], sys.argv[2]
prs = Presentation(SRC)

# Ta bort mallens exempelsidor (python-pptx sparar bara delar som fortfarande används)
sld_ids = prs.slides._sldIdLst
for sld_id in list(sld_ids):
    prs.part.drop_rel(sld_id.rId)
    sld_ids.remove(sld_id)

layouts = {l.name: l for m in prs.slide_masters for l in m.slide_layouts}

A = "http://schemas.openxmlformats.org/drawingml/2006/main"
P = "http://schemas.openxmlformats.org/presentationml/2006/main"


def ph(slide, idx):
    for p in slide.placeholders:
        if p.placeholder_format.idx == idx:
            return p
    raise KeyError(idx)


def set_tokens(shape, tokens):
    """Ett stycke per markör, utan egen formatering (layouten bestämmer)."""
    tf = shape.text_frame
    tf.text = tokens[0]
    for t in tokens[1:]:
        tf.add_paragraph().text = t


def footer(slide, n):
    """Datum och sidnummer som på mallens egna sidor."""
    tree = slide.shapes._spTree
    xml = (
        f'<p:sp xmlns:p="{P}" xmlns:a="{A}"><p:nvSpPr><p:cNvPr id="900" name="Datum"/>'
        '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="dt" sz="half" idx="10"/></p:nvPr></p:nvSpPr>'
        '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="sv-SE"/><a:t>{{DATUM}}</a:t></a:r></a:p></p:txBody></p:sp>'
    )
    tree.append(etree.fromstring(xml))
    xml = (
        f'<p:sp xmlns:p="{P}" xmlns:a="{A}"><p:nvSpPr><p:cNvPr id="901" name="Sidnummer"/>'
        '<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ftr" sz="quarter" idx="11"/></p:nvPr></p:nvSpPr>'
        '<p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p>'
        '<a:fld id="{2A787FE0-54BD-6940-860C-C2D6FB51E299}" type="slidenum"><a:rPr lang="sv-SE"/>'
        f"<a:t>{n}</a:t></a:fld>"
        '</a:p></p:txBody></p:sp>'
    )
    tree.append(etree.fromstring(xml))


def notes(slide, key):
    slide.notes_slide.notes_text_frame.text = "{{" + key + "}}"


def add(layout_name):
    s = prs.slides.add_slide(layouts[layout_name])
    # Tomma platshållare som inte används (t.ex. SmartArt-ytan) tas bort
    return s


def drop_unused(slide, keep):
    for p in list(slide.placeholders):
        if p.placeholder_format.idx not in keep:
            p._element.getparent().remove(p._element)


# 1. Titelsida
s = add("2 Titelsida ljusröd")
t = ph(s, 13)
set_tokens(t, ["{{TITEL}}"])
# Bredare titelruta än mallens, så att långa artikeltitlar får plats
t.left, t.top, t.width, t.height = Inches(0.69), Inches(1.15), Inches(8.06), Inches(1.66)
set_tokens(ph(s, 1), ["{{KALLA}}", "{{FORFATTARE}}", "{{ID}}", "{{PRESENTATOR}}"])
drop_unused(s, {13, 1})
# Titelsidans layout har eget datum och sidnummer
notes(s, "NOTES_1")

# 2. Bakgrund och frågeställning
s = add("5 Rubrik")
set_tokens(ph(s, 14), ["{{S2_RUBRIK}}"])
set_tokens(ph(s, 1), ["{{S2_TEXT}}"])
drop_unused(s, {14, 1})
footer(s, 2)
notes(s, "NOTES_2")

# 3. Design, population och effektmått i tre kolumner
s = add("6 Rubrik tre kolumner")
set_tokens(ph(s, 14), ["{{S3_RUBRIK}}"])
set_tokens(ph(s, 1), ["{{S3_K1}}"])
set_tokens(ph(s, 12), ["{{S3_K2}}"])
set_tokens(ph(s, 13), ["{{S3_K3}}"])
drop_unused(s, {14, 1, 12, 13})
footer(s, 3)
notes(s, "NOTES_3")

# 4. Resultat i tabell
s = add("8 Tabell")
set_tokens(ph(s, 15), ["{{S4_RUBRIK}}"])
obj = ph(s, 13)  # innehållsytan; tabellen läggs på samma plats
gf = s.shapes.add_table(4, 4, obj.left, obj.top, obj.width, Inches(2.2))
obj._element.getparent().remove(obj._element)
tbl = gf.table
tbl._tbl.tblPr.set("firstRow", "1")
tbl._tbl.tblPr.set("bandRow", "1")
style = tbl._tbl.tblPr.find(qn("a:tableStyleId"))
if style is None:
    style = etree.SubElement(tbl._tbl.tblPr, qn("a:tableStyleId"))
style.text = "{0E3FDE45-AF77-4B5C-9715-49D594BDF05E}"  # samma tabellstil som mallens tabellsida
widths = [Inches(2.4), Inches(2.0), Inches(2.0), Inches(1.99)]
for i, w in enumerate(widths):
    tbl.columns[i].width = w
for r in range(4):
    tbl.rows[r].height = Inches(0.55)
    for c in range(4):
        cell = tbl.cell(r, c)
        cell.text = "{{T_%d_%d}}" % (r, c)
        run = cell.text_frame.paragraphs[0].runs[0]
        run.font.size = Pt(12)
        run.font.bold = r == 0
drop_unused(s, {15})
footer(s, 4)
notes(s, "NOTES_4")

# 5. Huvudfigur
s = add("5 Rubrik")
set_tokens(ph(s, 14), ["{{S5_RUBRIK}}"])
set_tokens(ph(s, 1), ["{{S5_TEXT}}"])
drop_unused(s, {14, 1})
footer(s, 5)
notes(s, "NOTES_5")

# 6. Säkerhet/styrkor/begränsningar
s = add("6 Rubrik tre kolumner")
set_tokens(ph(s, 14), ["{{S6_RUBRIK}}"])
set_tokens(ph(s, 1), ["{{S6_K1}}"])
set_tokens(ph(s, 12), ["{{S6_K2}}"])
set_tokens(ph(s, 13), ["{{S6_K3}}"])
drop_unused(s, {14, 1, 12, 13})
footer(s, 6)
notes(s, "NOTES_6")

# 7. Betydelse för våra patienter
s = add("5 Rubrik")
set_tokens(ph(s, 14), ["{{S7_RUBRIK}}"])
set_tokens(ph(s, 1), ["{{S7_TEXT}}"])
drop_unused(s, {14, 1})
footer(s, 7)
notes(s, "NOTES_7")

# 8. Diskussion
s = add("9 Avslut")
set_tokens(ph(s, 13), ["{{S8_RUBRIK}}"])
set_tokens(ph(s, 1), ["{{S8_TEXT}}"])
drop_unused(s, {13, 1})
notes(s, "NOTES_8")

prs.core_properties.title = "Journal club"
prs.save(OUT)
print("sparad", OUT)
