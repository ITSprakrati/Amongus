import requests
import os
import time

pdf_path = 'demo_assets/sample_answer_script.pdf'
with open(pdf_path, 'rb') as f:
    files = {'file': (os.path.basename(pdf_path), f, 'application/pdf')}
    data = {'document_type': 'ANSWER_SCRIPT'}
    r = requests.post('http://127.0.0.1:8000/api/v1/documents/upload', files=files, data=data)
    res = r.json()
    print('Uploaded:', res)
    job_id = res['id']

for _ in range(5):
    time.sleep(1)
    r2 = requests.get(f'http://127.0.0.1:8000/api/v1/documents/status/{job_id}')
    status_res = r2.json()
    print('Status:', status_res)
    if status_res['status'] != 'PROCESSING':
        break
