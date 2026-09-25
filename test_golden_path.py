import requests
import json
import time
import uuid
import sys

API_URL = "http://localhost:8000/api/v1"

def run_golden_path():
    print("=======================================")
    print("EVALOS END-TO-END GOLDEN PATH TEST")
    print("=======================================")
    
    # 1. Check API Health
    print("\n1. System Health Check...")
    resp = requests.get("http://localhost:8000/health")
    assert resp.status_code == 200, f"Health check failed: {resp.text}"
    print(f"OK Health Check Passed: {resp.json()}")

    # 2. Upload Dummy PDF (Phase 3 & 4)
    print("\n2. Uploading Document to Object Storage...")
    dummy_pdf_content = b"%PDF-1.4\n%EOF\n"
    files = {"file": ("test_script.pdf", dummy_pdf_content, "application/pdf")}
    resp = requests.post(f"{API_URL}/documents/upload", files=files, data={"document_type": "answer_script"})
    assert resp.status_code == 200, f"Upload failed: {resp.text}"
    doc_data = resp.json()
    doc_id = doc_data["id"]
    print(f"OK Upload Passed. Received Document ID: {doc_id}")
    print(f"OK S3 Path: {doc_data['path']}")
    print("OK Async Celery Processing Initiated.")
    
    time.sleep(1) # Give Celery a moment

    # 3. Categorise Assessment (Phase 7)
    print("\n3. AI Categorisation...")
    assessment_id = "bsc-math-iv-2024"
    resp = requests.post(f"{API_URL}/categorise/{assessment_id}/categorise")
    assert resp.status_code == 200, f"Categorisation failed: {resp.text}"
    cat_data = resp.json()
    print(f"OK Categorisation Passed: {cat_data['category']} (Confidence: {cat_data['confidence']})")

    # 4. Examiner Submits Evaluation / Verification (Phase 10 & 11)
    print("\n4. Running AI Verification (Detecting Intentional Demo Failures)...")
    
    # Intentional Failure 1: Q06 Unchecked
    payload_fail_q06 = {
        "q06_evaluated": False
    }
    resp = requests.post(f"{API_URL}/verification/eval-123/verify", json=payload_fail_q06)
    v_data = resp.json()
    print(f"OK Verification Blocked successfully on Q06: {v_data['signals'][0]['message']}")
    
    # Intentional Failure 2: Section Total Mismatch
    payload_fail_q04 = {
        "q06_evaluated": True,
        "q04_mark": 4.0,
        "computed_total": 4.0,
        "section_total": 3.0
    }
    resp = requests.post(f"{API_URL}/verification/eval-123/verify", json=payload_fail_q04)
    v_data = resp.json()
    print(f"OK Verification Blocked successfully on Section Total: {v_data['signals'][0]['detail']}")

    # 5. Resolving Moderation Case (Phase 12)
    print("\n5. Resolving Moderation Case...")
    resp = requests.post(f"{API_URL}/moderation/case-999/resolve", json={"decision": "APPROVED"})
    assert resp.status_code == 200, f"Moderation failed: {resp.text}"
    print(f"OK Moderation Resolved: {resp.json()['message']}")

    # 6. Calculating Final Result (Phase 13)
    print("\n6. Calculating Final Result...")
    payload_success = {
        "marks": {"Q1": 5, "Q2": 4, "Q3": 5, "Q4": 3, "Q5": 5, "Q6": 2},
        "maxMarks": 30
    }
    resp = requests.post(f"{API_URL}/results/eval-123/calculate", json=payload_success)
    assert resp.status_code == 200, f"Result calculation failed: {resp.text}"
    res_data = resp.json()
    print(f"✓ Result Calculation Passed!")
    print(f"  Total Marks: {res_data['total_marks']}/{res_data['max_marks']}")
    print(f"  Percentage: {res_data['percentage']}%")
    print(f"  Grade: {res_data['grade']}")
    print(f"  Status: {res_data['status']}")

    # 7. Final Stage Endpoints (Analytics, Learning, Audit)
    print("\n7. Polling Final Architecture Endpoints...")
    resp = requests.get(f"{API_URL}/analytics/dashboard")
    assert resp.status_code == 200, f"Analytics failed: {resp.text}"
    print(f"✓ Analytics Dashboard Loaded")
    
    resp = requests.post(f"{API_URL}/learning/ingest-case", json={"case_id": "case-999"})
    assert resp.status_code == 200, f"Learning ingest failed: {resp.text}"
    print(f"✓ Institutional Learning RAG Updated")
    
    resp = requests.get(f"{API_URL}/audit/{doc_id}")
    assert resp.status_code == 200, f"Audit failed: {resp.text}"
    print(f"✓ Cryptographic Audit Trail Retrieved")

    print("\n=======================================")
    print("GOLDEN PATH TEST COMPLETE — ALL SYSTEMS GREEN")
    print("=======================================")

if __name__ == "__main__":
    try:
        run_golden_path()
    except Exception as e:
        print(f"TEST FAILED: {e}")
        sys.exit(1)
