"""
Item A checks: real PDF marking-scheme parsing -> real Assessment/Question rows (or an honest UNAVAILABLE).
Needs a running API (+ worker unless EVALOS_LITE) and DB access for direct row checks.
    python3 test_marking_scheme_parsing.py
DB checks use DATABASE_URL (Postgres or sqlite:///path).
"""
import io, os, sys, time
import requests
from reportlab.pdfgen import canvas

API = os.environ.get("API_URL", "http://localhost:8000/api/v1")
DB_URL = os.environ.get("DATABASE_URL", "postgresql://evalos:evalos_password@localhost:5432/evalos_db")
from sqlalchemy import create_engine, text
engine = create_engine(DB_URL)
n_pass = 0


def check(name, cond, detail=""):
    global n_pass
    print(("  PASS  " if cond else "  FAIL  ") + name + (f"  [{detail}]" if detail else ""))
    if not cond:
        raise SystemExit(f"FAILED: {name} {detail}")
    n_pass += 1


def pdf(lines):
    b = io.BytesIO(); c = canvas.Canvas(b); y = 800
    for ln in lines:
        c.drawString(50, y, ln); y -= 20
    c.save(); return b.getvalue()


def sql(q, **kw):
    if engine.dialect.name == "sqlite":  # SQLite stores UUID columns as 32-char hex (no dashes)
        kw = {k: (v.replace("-", "") if isinstance(v, str) and len(v) == 36 else v) for k, v in kw.items()}
    with engine.connect() as cn:
        return cn.execute(text(q), kw).fetchall()


def upload(data, name, kind):
    r = requests.post(f"{API}/documents/upload", files={"file": (name, data, "application/pdf")},
                      data={"document_type": kind})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def wait(job, timeout=60):
    for _ in range(timeout * 2):
        s = requests.get(f"{API}/documents/status/{job}").json()
        if s["status"] in ("READY", "FAILED"):
            return s
        time.sleep(0.5)
    raise SystemExit("job never finished: " + job)


def active():
    return requests.get(f"{API}/assessments/active").json()


def counts():
    return (sql("select count(*) from assessments")[0][0], sql("select count(*) from questions")[0][0])


# ---- pure parser unit checks ---------------------------------------------------------------
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "backend"))
from services.marking_scheme_parser import parse_marking_scheme as P
print("\n=== parser (pure function)")
r = P("Q1 (5 marks)\nQ.2 [6]\nQuestion 3 - 10 marks\nQ4  5M\nQuestion 5: Define x. (3 marks)\nQ6\n(2 marks)")
check("all six marker styles parsed with exact marks",
      [(q["number"], q["max_marks"]) for q in r["questions"]] == [(1, 5), (2, 6), (3, 10), (4, 5), (5, 3), (6, 2)], str(r))
check("stem captured from same line", r["questions"][4]["stem"] == "Define x")
check("no markers -> UNAVAILABLE, empty list", P("Some prose about the course.")["status"] == "UNAVAILABLE" and P("Some prose")["questions"] == [])
check("empty text -> UNAVAILABLE", P("")["status"] == "UNAVAILABLE")
check("marker without marks -> UNAVAILABLE (never guessed)", P("Q1 (5 marks)\nQ2 describe things")["status"] == "UNAVAILABLE")
check("conflicting marks -> UNAVAILABLE", P("Q1 (5 marks)\nQ1 (6 marks)")["status"] == "UNAVAILABLE")
check("same question repeated with same marks -> kept once", len(P("Q1 (5 marks)\nQ1 (5 marks)\nQ2 [3]")["questions"]) == 2)
check("'see Q1' mid-sentence is not a marker", P("Refer to Q1 (5 marks) in the paper")["status"] == "UNAVAILABLE")

# ---- end-to-end -------------------------------------------------------------------------------
print("\n=== 0. baseline: provisioned fixture is active")
a0 = active()
check("fixture assessment active", a0["status"] == "READY" and a0["assessment"]["code"] == "BSC-MATH-IV-2024" and len(a0["questions"]) == 6)
base = counts()

print("\n=== 1. answer-script upload is typed correctly and its OCR result is persisted")
sc = upload(pdf(["Candidate answers here", "Q1 answer text"]), "cand.pdf", "answerScripts")
s = wait(sc)
check("job_type stored as answerScripts (form field honoured)", sql("select job_type from processing_jobs where id=:i", i=sc)[0][0] == "answerScripts")
check("OCR reached READY with persisted documentIntelligence", s["status"] == "READY" and "documentIntelligence" in s["result_data"])
check("answer script never triggers marking-scheme parsing", "parsing" not in s["result_data"])

print("\n=== 2. UNPARSEABLE marking scheme leaves the fixture untouched")
bad = upload(pdf(["This course guide has no numbered questions.", "It only talks about topics in general."]), "guide.pdf", "markingScheme")
s = wait(bad)
p = s["result_data"]["parsing"]
check("parsing.status == UNAVAILABLE with a reason", p["status"] == "UNAVAILABLE" and p["reason"], p.get("reason"))
check("no Assessment/Question rows created", counts() == base, str(counts()))
a = active()
check("active assessment is still the fixture, still 6 questions", a["assessment"]["code"] == "BSC-MATH-IV-2024" and len(a["questions"]) == 6)

print("\n=== 3. marker WITHOUT marks is rejected honestly")
nm = upload(pdf(["Q1 (5 marks)", "Q2 Explain vectors"]), "partial.pdf", "markingScheme")
p = wait(nm)["result_data"]["parsing"]
check("UNAVAILABLE naming Q2", p["status"] == "UNAVAILABLE" and "Q2" in p["reason"], p["reason"])
check("still nothing created", counts() == base)

print("\n=== 4. REAL marking scheme -> real rows")
LINES = ["Physics Marking Scheme", "Q1 (4 marks) Define displacement", "Q.2 [6] State Newton's laws",
         "Question 3 - 5 marks Derive v = u + at", "Q4  10M Explain momentum", "Question 5: Solve collision. (3 marks)", "Q6 (7 marks) Describe impulse"]
good = upload(pdf(LINES), "Physics_Scheme_2026.pdf", "markingScheme")
s = wait(good)
p = s["result_data"]["parsing"]
check("parsing PARSED, 6 questions", p["status"] == "PARSED" and p["question_count"] == 6, str(p))
check("persisted assessment_id recorded on the job", p["assessment_id"])
rows = sql("select q.text, q.max_marks from questions q join question_sections s on q.section_id=s.id where s.assessment_id=:a order by q.text", a=p["assessment_id"])
check("6 Question rows in the database with exact marks", [r[1] for r in rows] == [4, 6, 5, 10, 3, 7], str(rows))
check("exactly one new assessment + 6 questions", counts() == (base[0] + 1, base[1] + 6), str(counts()))
a = active()
check("GET /assessments/active now returns the parsed assessment",
      a["assessment"]["id"] == p["assessment_id"] and a["assessment"]["total_marks"] == 35, a["assessment"])
check("labels Q01..Q06 + max_marks correct",
      [(q["label"], q["max_marks"]) for q in a["questions"]] == [("Q01", 4), ("Q02", 6), ("Q03", 5), ("Q04", 10), ("Q05", 3), ("Q06", 7)])
check("stem carried into question text", "Define displacement" in a["questions"][0]["text"])

print("\n=== 5. re-upload of the identical scheme does NOT duplicate")
again = upload(pdf(LINES), "Physics_Scheme_2026_copy.pdf", "markingScheme")
p2 = wait(again)["result_data"]["parsing"]
check("PARSED, reused_existing", p2["status"] == "PARSED" and p2["reused_existing"] is True and p2["assessment_id"] == p["assessment_id"])
check("no additional rows", counts() == (base[0] + 1, base[1] + 6))

print("\n=== 6. a later UNPARSEABLE upload does not disturb the parsed assessment")
wait(upload(pdf(["nothing useful"]), "junk.pdf", "markingScheme"))
check("parsed assessment still active", active()["assessment"]["id"] == p["assessment_id"] and counts() == (base[0] + 1, base[1] + 6))

print("\n=== 7. downstream golden path works on the parsed questions")
A = active(); aid = A["assessment"]["id"]; qs = A["questions"]
for q in qs[:5]:
    r = requests.post(f"{API}/evaluation/session/mark", json={"assessment_id": aid, "question_id": q["id"], "score": q["max_marks"] - 1})
    assert r.status_code == 200, r.text
ev = r.json()["evaluation_id"]
v = requests.post(f"{API}/verification/{ev}/verify").json()
check("verification flags the real unmarked parsed question (Q06)",
      v["status"] == "REVIEW_REQUIRED" and [s["question"] for s in v["signals"] if s["type"] == "NOT_EVALUATED"] == ["Q06"], str(v["signals"]))
check("result blocked while unresolved", requests.post(f"{API}/results/{ev}/calculate").json()["status"] == "BLOCKED")
requests.post(f"{API}/evaluation/session/mark", json={"assessment_id": aid, "question_id": qs[5]["id"], "score": 7})
requests.post(f"{API}/moderation/{v['case_id']}/resolve", json={"decision": "APPROVED"})
res = requests.post(f"{API}/results/{ev}/calculate").json()
db_sum = sql("select sum(score) from marks where evaluation_id=:e and question_id is not null", e=ev)[0][0]
check("result == SUM(persisted marks) over parsed questions, max 35",
      res["status"] == "PUBLISHED" and res["total_marks"] == db_sum == (3 + 5 + 4 + 9 + 2 + 7) and res["max_marks"] == 35, str(res))

print(f"\nALL {n_pass} CHECKS PASSED")
