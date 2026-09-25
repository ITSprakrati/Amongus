import requests
import time
import os
from colorama import init, Fore

init(autoreset=True)

API_URL = "http://127.0.0.1:8000/api/v1"
HEADERS = {"X-User-Role": "Proctor", "X-User-ID": "00000000-0000-0000-0000-000000000001"}

def run_test():
    print(Fore.CYAN + "=== EVALOS GOLDEN PATH TEST ===")
    
    # 1. Fetch Golden Assessment
    print(Fore.YELLOW + "\n1. Fetching golden assessment...")
    r = requests.get(f"{API_URL}/assessments/")
    assert r.status_code == 200
    assessments = r.json()
    golden = next((a for a in assessments if a["code"] == "GOLDEN-MATH-101"), None)
    if not golden:
        print(Fore.RED + "Golden assessment not found in DB!")
        return
    print(Fore.GREEN + f"Found: {golden['title']} ({golden['id']})")
    
    # Get questions
    r = requests.get(f"{API_URL}/assessments/{golden['id']}")
    assert r.status_code == 200
    data = r.json()
    questions = data.get("questions", [])
    print(Fore.GREEN + f"Loaded {len(questions)} questions")
    
    # 2. Upload marking scheme
    print(Fore.YELLOW + "\n2. Uploading marking scheme...")
    with open("demo_assets/sample_marking_scheme.pdf", "rb") as f:
        r = requests.post(f"{API_URL}/documents/upload", files={"file": ("sample_marking_scheme.pdf", f, "application/pdf")}, data={"document_type": "MARKING_SCHEME"})
    assert r.status_code == 200
    ms_job_id = r.json()["id"]
    print(Fore.GREEN + f"Uploaded MS job: {ms_job_id}")
    
    # Poll
    while True:
        r = requests.get(f"{API_URL}/documents/status/{ms_job_id}")
        if r.json()["status"] == "READY":
            break
        elif r.json()["status"] == "FAILED":
            print(Fore.RED + "MS Job FAILED!")
            return
        time.sleep(1)
    
    # 3. Upload answer script
    print(Fore.YELLOW + "\n3. Uploading answer script...")
    with open("demo_assets/sample_answer_script.pdf", "rb") as f:
        r = requests.post(f"{API_URL}/documents/upload", files={"file": ("sample_answer_script.pdf", f, "application/pdf")}, data={"document_type": "ANSWER_SCRIPT"})
    assert r.status_code == 200
    as_job_id = r.json()["id"]
    print(Fore.GREEN + f"Uploaded AS job: {as_job_id}")
    
    # Poll
    while True:
        r = requests.get(f"{API_URL}/documents/status/{as_job_id}")
        if r.json()["status"] == "READY":
            break
        elif r.json()["status"] == "FAILED":
            print(Fore.RED + "AS Job FAILED!")
            return
        time.sleep(1)
        
    # 4. Categorise
    print(Fore.YELLOW + "\n4. Categorising script...")
    r = requests.post(f"{API_URL}/categorise/{as_job_id}/categorise")
    assert r.status_code == 200
    cat_result = r.json()
    print(Fore.GREEN + f"Category: {cat_result['category']} (Method: {cat_result.get('method', 'unknown')})")

    # 5. Evaluate (mark entry)
    print(Fore.YELLOW + "\n5. Entering marks...")
    for i, q in enumerate(questions):
        score = min(q['max_marks'], i)  # some arbitrary score
        r = requests.post(f"{API_URL}/evaluation/session/mark", json={"assessment_id": golden['id'], "question_id": q['id'], "score": score}, headers=HEADERS)
        if r.status_code != 200:
            print(Fore.RED + f"Mark error: {r.text}")
            return
    print(Fore.GREEN + "Marks entered successfully.")
    
    eval_id = r.json()["evaluation_id"]
    
    # Enter total
    r = requests.post(f"{API_URL}/evaluation/session/recorded-total", json={"assessment_id": golden['id'], "recorded_total": 99}, headers=HEADERS)
    assert r.status_code == 200
    print(Fore.GREEN + "Recorded total entered (deliberately wrong for verification).")
    
    # 6. Verification
    print(Fore.YELLOW + "\n6. Verification...")
    r = requests.post(f"{API_URL}/verification/{eval_id}/verify")
    assert r.status_code == 200
    ver_result = r.json()
    print(Fore.GREEN + f"Verification Status: {ver_result['status']}")
    case_id = ver_result.get("case_id")
    if case_id:
        print(Fore.GREEN + f"Moderation Case created: {case_id}")
    
    # 7. Moderation
    if case_id:
        print(Fore.YELLOW + "\n7. Resolving Moderation...")
        r = requests.post(f"{API_URL}/moderation/{case_id}/resolve", json={"decision": "AMENDED", "adjusted_score": 15}, headers=HEADERS)
        if r.status_code != 200:
            print(Fore.RED + f"Moderation error: {r.text}")
            return
        print(Fore.GREEN + "Moderation resolved successfully.")
        
    # 8. Results
    print(Fore.YELLOW + "\n8. Computing Result...")
    r = requests.post(f"{API_URL}/results/{eval_id}/calculate")
    if r.status_code != 200:
        print(Fore.RED + f"Results error: {r.text}")
        return
    res = r.json()
    print(Fore.GREEN + f"Final Grade: {res['grade']} ({res['percentage']}%)")
    
    # 9. Audit Trail
    print(Fore.YELLOW + "\n9. Audit Trail...")
    r = requests.get(f"{API_URL}/audit/{eval_id}")
    assert r.status_code == 200
    audit = r.json()
    print(Fore.GREEN + f"Found {len(audit['events'])} audit events.")
    for ev in audit['events']:
        print(f"  [{ev['timestamp']}] {ev['action']} by {ev['actor']}")
        
    print(Fore.CYAN + "\n=== TEST COMPLETE ===")

if __name__ == "__main__":
    run_test()
