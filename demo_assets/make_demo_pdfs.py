"""Regenerates the three demo PDFs (needs `pip install reportlab`). The generated PDFs are committed."""
import os
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas

HERE = os.path.dirname(os.path.abspath(__file__))


def write(name, pages):
    c = canvas.Canvas(os.path.join(HERE, name), pagesize=A4)
    for lines in pages:
        y = 790
        for kind, text in lines:
            c.setFont("Helvetica-Bold" if kind == "h" else "Helvetica", 15 if kind == "h" else 11)
            c.drawString(56, y, text)
            y -= 26 if kind == "h" else 20
        c.showPage()
    c.save()


write("sample_marking_scheme.pdf", [[
    ("h", "B.Sc. Mathematics & Spatial Vectors - Marking Scheme"),
    ("t", ""),
    ("t", "Q1 (4 marks) Define a vector space and give one example."),
    ("t", "Q2 (6 marks) Prove that the dot product is commutative."),
    ("t", "Q3 (5 marks) Find the cross product of (1,2,3) and (4,5,6)."),
    ("t", "Q4 (5 marks) Explain linear independence of vectors."),
    ("t", "Q5 (6 marks) Compute the angle between two given vectors."),
    ("t", "Q6 (4 marks) State the triangle inequality with a short proof."),
    ("t", ""),
    ("t", "Total: 30 marks"),
]])

write("sample_answer_script.pdf", [
    [("h", "Candidate 20417 - Answer Script (page 1)"),
     ("t", "Q1. A vector space is a set closed under addition and scalar multiplication."),
     ("t", "Example: R^3 with the usual operations."),
     ("t", "Q2. For u.v = |u||v|cos(theta), swapping u and v does not change the value.")],
    [("h", "Candidate 20417 - Answer Script (page 2)"),
     ("t", "Q3. (1,2,3) x (4,5,6) = (2*6-3*5, 3*4-1*6, 1*5-2*4) = (-3, 6, -3)."),
     ("t", "Q4. Vectors are independent if only the zero combination gives the zero vector.")],
    [("h", "Candidate 20417 - Answer Script (page 3)"),
     ("t", "Q5. cos(theta) = (u.v)/(|u||v|), then theta = arccos of that value."),
     ("t", "Q6. (left blank by the candidate)")],
])

write("sample_unparseable_scheme.pdf", [[
    ("h", "Course Guide - Spatial Vectors"),
    ("t", "This narrative handout describes the topics covered in the course."),
    ("t", "It lists reading material and lecture themes only."),
    ("t", "It contains no numbered questions and no mark allocations."),
]])
print("demo PDFs written to", HERE)
