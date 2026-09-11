import io
from typing import Any, Dict

from docx import Document
from docx.shared import Pt

# Plain, single-column, standard-headings layout — no tables, text boxes, images,
# or multi-column sections, which is what trips up ATS parsers.


def render_resume_docx(resume: Dict[str, Any]) -> bytes:
    doc = Document()
    style = doc.styles["Normal"]
    style.font.name = "Calibri"
    style.font.size = Pt(11)

    contact = resume.get("contact", {})
    doc.add_heading(contact.get("name", ""), level=0)
    contact_line = " | ".join(
        v for v in [contact.get("email"), contact.get("phone"), contact.get("location")] if v
    )
    if contact_line:
        doc.add_paragraph(contact_line)

    if resume.get("summary"):
        doc.add_heading("Summary", level=1)
        doc.add_paragraph(resume["summary"])

    if resume.get("skills"):
        doc.add_heading("Skills", level=1)
        doc.add_paragraph(", ".join(resume["skills"]))

    if resume.get("experience"):
        doc.add_heading("Experience", level=1)
        for job in resume["experience"]:
            header = f"{job.get('title', '')} — {job.get('company', '')}"
            dates = " to ".join(v for v in [job.get("start_date"), job.get("end_date")] if v)
            line = " | ".join(v for v in [header, job.get("location"), dates] if v)
            doc.add_paragraph(line, style="Heading 3")
            for bullet in job.get("bullets", []):
                doc.add_paragraph(bullet, style="List Bullet")

    if resume.get("education"):
        doc.add_heading("Education", level=1)
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
            doc.add_paragraph(line)

    if resume.get("certifications"):
        doc.add_heading("Certifications", level=1)
        for cert in resume["certifications"]:
            doc.add_paragraph(cert, style="List Bullet")

    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()
