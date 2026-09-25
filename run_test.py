import time
import requests
from reportlab.pdfgen import canvas
import sys

def create_pdf(filename, text):
    c = canvas.Canvas(filename)
    y = 800
    for line in text.split('\n'):
        c.drawString(100, y, line)
        y -= 20
    c.save()

BASE_URL = "http://127.0.0.1:8000/api/v1"

def run_golden_path(dataset_name, ms_text, qp_text, as_text):
    print(f"\n--- RUNNING GOLDEN PATH: {dataset_name} ---")
    
    ms_pdf = f"{dataset_name}_MS.pdf"
    qp_pdf = f"{dataset_name}_QP.pdf"
    as_pdf = f"{dataset_name}_Script.pdf"
    
    create_pdf(ms_pdf, ms_text)
    create_pdf(qp_pdf, qp_text)
    create_pdf(as_pdf, as_text)
    
    # 1. Upload
    print("1. Uploading Marking Scheme...")
    with open(ms_pdf, "rb") as f:
        r = requests.post(f"{BASE_URL}/documents/upload", files={"file": (ms_pdf, f, "application/pdf")}, data={"document_type": "MARKING_SCHEME"})
    print("MS Upload:", r.json())
    ms_id = r.json()["id"]

    print("1. Uploading Question Paper...")
    with open(qp_pdf, "rb") as f:
        r = requests.post(f"{BASE_URL}/documents/upload", files={"file": (qp_pdf, f, "application/pdf")}, data={"document_type": "QUESTION_PAPER"})
    print("QP Upload:", r.json())
    
    print("1. Uploading Answer Script...")
    with open(as_pdf, "rb") as f:
        r = requests.post(f"{BASE_URL}/documents/upload", files={"file": (as_pdf, f, "application/pdf")}, data={"document_type": "ANSWER_SCRIPT"})
    print("AS Upload:", r.json())
    as_id = r.json()["id"]
    
    # Wait for processing
    print("Waiting for celery processing (synchronous in lite mode)...")
    time.sleep(2)
    
    # Check Active Assessment (Extraction worked)
    r = requests.get(f"{BASE_URL}/assessments/active")
    active = r.json()
    print("2. Extracted Assessment:", active)
    
    if active.get("status") != "READY":
        print("FAIL: Assessment not extracted")
        return
        
    assessment_id = active["assessment"]["id"]
    questions = active["questions"]
    
    # Categorise
    print(f"3. Categorising Script {as_id}...")
    r = requests.post(f"{BASE_URL}/categorise/{as_id}/categorise")
    print("Categorisation:", r.json())
    
    # Get Session
    r = requests.get(f"{BASE_URL}/evaluation/session?assessment_id={assessment_id}")
    print("Initial Session:", r.json())
    
    # Submit Marks
    print("4. Submitting Marks...")
    marks = {}
    for i, q in enumerate(questions):
        score = q["max_marks"] - (i % 2) # Just arbitrary scores
        r = requests.post(f"{BASE_URL}/evaluation/session/mark", json={"assessment_id": assessment_id, "question_id": q["id"], "score": score})
        marks = r.json().get("marks", {})
        eval_id = r.json().get("evaluation_id")
    
    print("Marks saved:", marks)
    
    # Submit recorded total
    total = sum(marks.values())
    r = requests.post(f"{BASE_URL}/evaluation/session/recorded-total", json={"assessment_id": assessment_id, "recorded_total": total})
    print("Recorded Total saved:", r.json().get("recorded_total"))
    
    # Verify
    print(f"5. Verifying Evaluation {eval_id}...")
    r = requests.post(f"{BASE_URL}/verification/{eval_id}/verify")
    verif = r.json()
    print("Verification:", verif)
    
    if verif["status"] == "REVIEW_REQUIRED":
        print("Verification raised signals:", verif["signals"])
        # Resolve moderation
        case_id = verif["case_id"]
        if case_id:
            print(f"Resolving moderation {case_id}...")
            r = requests.post(f"{BASE_URL}/moderation/{case_id}/resolve", json={"decision": "Approved by supervisor"})
            print("Moderation Resolution:", r.json())
            
    # Generate Result
    print(f"6. Generating Result for {eval_id}...")
    r = requests.post(f"{BASE_URL}/results/{eval_id}/calculate")
    print("Result:", r.json())
    
    # Check Audit logs
    print(f"7. Audit Logs for {eval_id}...")
    r = requests.get(f"{BASE_URL}/audit/{eval_id}")
    if r.status_code == 200:
        logs = r.json().get("events", [])
        print(f"Found {len(logs)} audit logs for this evaluation.")
        for log in logs:
            print(f" - {log['action']}: {log['details']}")
    else:
        print("Audit Logs error:", r.json())
        
    print("--- SUCCESS ---")

# Run Dataset 1
run_golden_path(
    "CS-101", 
    "Q1 (5 marks) Define CPU.\nQ2 (5 marks) Explain RAM.",
    "Question Paper text here...",
    "Student answer text here..."
)

# Run Dataset 2
run_golden_path(
    "PHYS-202",
    "Q1 (10 marks) Force.\nQ2 (10 marks) Velocity.\nQ3 (10 marks) Momentum.",
    "Question Paper text here...",
    "Student answer text here..."
)
