import io
from typing import Any, Dict

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_TAB_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor

# Plain, single-column, standard-headings layout — no tables, text boxes, images,
# or multi-column sections, which is what trips up ATS parsers. Deliberately
# skips python-docx's built-in Title/Heading styles (Calibri Light, blue,
# oversized) in favor of hand-styled bold/black paragraphs — the default Word
# heading theme is what made early versions of this render look like an
# unedited Word template rather than an actual resume.

MARGIN_INCHES = 0.6
PAGE_WIDTH_INCHES = 8.5
USABLE_WIDTH_INCHES = PAGE_WIDTH_INCHES - 2 * MARGIN_INCHES
BODY_FONT = "Calibri"
INK = RGBColor(0x1A, 0x1A, 0x2E)


def _set_bottom_border(paragraph) -> None:
    """A thin rule under section headers — the one detail that most makes a
    plain bold-text header read as an intentional resume section rather than
    just a bolded line of text."""
    pPr = paragraph._p.get_or_add_pPr()
    pBdr = OxmlElement("w:pBdr")
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), "6")
    bottom.set(qn("w:space"), "2")
    bottom.set(qn("w:color"), "1A1A2E")
    pBdr.append(bottom)
    pPr.append(pBdr)


def _section_header(doc: Document, text: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    run = p.add_run(text.upper())
    run.bold = True
    run.font.size = Pt(11.5)
    run.font.name = BODY_FONT
    run.font.color.rgb = INK
    _set_bottom_border(p)


def _bullet(doc: Document, text: str) -> None:
    p = doc.add_paragraph(style="List Bullet")
    p.paragraph_format.space_after = Pt(2)
    p.paragraph_format.line_spacing = 1.05
    for run in p.runs:
        run.font.size = Pt(10.5)
        run.font.name = BODY_FONT


def _job_header(doc: Document, title: str, company: str, location: str, dates: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.tab_stops.add_tab_stop(Inches(USABLE_WIDTH_INCHES), WD_TAB_ALIGNMENT.RIGHT)

    left = ", ".join(v for v in [title, company] if v)
    left_run = p.add_run(left)
    left_run.bold = True
    left_run.font.size = Pt(11)
    left_run.font.name = BODY_FONT

    if dates:
        date_run = p.add_run(f"\t{dates}")
        date_run.bold = True
        date_run.font.size = Pt(10)
        date_run.font.name = BODY_FONT

    if location:
        loc_p = doc.add_paragraph()
        loc_p.paragraph_format.space_before = Pt(0)
        loc_p.paragraph_format.space_after = Pt(2)
        loc_run = loc_p.add_run(location)
        loc_run.italic = True
        loc_run.font.size = Pt(10)
        loc_run.font.name = BODY_FONT
        loc_run.font.color.rgb = RGBColor(0x44, 0x44, 0x44)


def _plain(doc: Document, text: str, *, size: float = 10.5, space_after: float = 3) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(space_after)
    p.paragraph_format.line_spacing = 1.08
    run = p.add_run(text)
    run.font.size = Pt(size)
    run.font.name = BODY_FONT


def render_resume_docx(resume: Dict[str, Any]) -> bytes:
    doc = Document()

    section = doc.sections[0]
    section.left_margin = Inches(MARGIN_INCHES)
    section.right_margin = Inches(MARGIN_INCHES)
    section.top_margin = Inches(0.5)
    section.bottom_margin = Inches(0.5)

    style = doc.styles["Normal"]
    style.font.name = BODY_FONT
    style.font.size = Pt(10.5)
    style.font.color.rgb = INK
    style.paragraph_format.space_after = Pt(3)

    contact = resume.get("contact", {})

    name_p = doc.add_paragraph()
    name_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    name_p.paragraph_format.space_after = Pt(2)
    name_run = name_p.add_run(contact.get("name", ""))
    name_run.bold = True
    name_run.font.size = Pt(18)
    name_run.font.name = BODY_FONT
    name_run.font.color.rgb = INK

    contact_line = " | ".join(
        v for v in [contact.get("location"), contact.get("phone"), contact.get("email")] if v
    )
    if contact_line:
        contact_p = doc.add_paragraph()
        contact_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        contact_p.paragraph_format.space_after = Pt(8)
        contact_run = contact_p.add_run(contact_line)
        contact_run.font.size = Pt(10)
        contact_run.font.name = BODY_FONT
        contact_run.font.color.rgb = RGBColor(0x44, 0x44, 0x44)

    if resume.get("summary"):
        _section_header(doc, "Summary")
        _plain(doc, resume["summary"])

    if resume.get("skills"):
        _section_header(doc, "Skills")
        _plain(doc, ", ".join(resume["skills"]), space_after=3)

    if resume.get("experience"):
        _section_header(doc, "Experience")
        for job in resume["experience"]:
            dates = " – ".join(v for v in [job.get("start_date"), job.get("end_date")] if v)
            _job_header(
                doc, job.get("title", ""), job.get("company", ""), job.get("location", ""), dates
            )
            for bullet in job.get("bullets", []):
                _bullet(doc, bullet)

    if resume.get("education"):
        _section_header(doc, "Education")
        for edu in resume["education"]:
            line = " — ".join(
                v
                for v in [
                    edu.get("degree"),
                    edu.get("field"),
                    edu.get("school"),
                    edu.get("graduation_date"),
                ]
                if v
            )
            _plain(doc, line, space_after=2)

    if resume.get("certifications"):
        _section_header(doc, "Certifications")
        for cert in resume["certifications"]:
            _bullet(doc, cert)

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
