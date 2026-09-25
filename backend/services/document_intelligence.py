import os
from abc import ABC, abstractmethod
from typing import Dict, Any, List
import io

# Optional local imports for OCR if available
try:
    import pytesseract
    from PIL import Image
    import fitz # PyMuPDF
    LOCAL_OCR_AVAILABLE = True
except ImportError:
    LOCAL_OCR_AVAILABLE = False


class DocumentIntelligenceProvider(ABC):
    @abstractmethod
    def process_document(self, file_path_or_bytes: bytes) -> Dict[str, Any]:
        pass

class LocalDocumentIntelligenceProvider(DocumentIntelligenceProvider):
    def __init__(self):
        self.provider_name = "Local-PyTesseract-MuPDF"
        
    def process_document(self, file_bytes: bytes) -> Dict[str, Any]:
        """
        Actually attempts to parse the PDF using PyMuPDF and Tesseract locally.
        """
        results = {
            "provider": self.provider_name,
            "pages": [],
            "structured_records": [],
            "metadata": {}
        }
        
        if not LOCAL_OCR_AVAILABLE:
            # Deterministic fallback if libraries missing
            results["pages"] = [{"page_num": 1, "text": "LOCAL OCR UNAVAILABLE. Source preserved.", "confidence": 0.0}]
            results["metadata"] = {"status": "FALLBACK_DETERMINISTIC"}
            return results
            
        try:
            doc = fitz.open(stream=file_bytes, filetype="pdf")
            results["metadata"]["total_pages"] = len(doc)
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                text = page.get_text("text")
                
                # If no text (scanned image), try OCR
                if not text.strip():
                    # Get RGB pixmap explicitly to avoid ValueError: not enough image data
                    pix = page.get_pixmap(alpha=False)
                    if pix.n < 3:
                        # Force RGB conversion if grayscale
                        pix = fitz.Pixmap(fitz.csRGB, pix)
                    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
                    text = pytesseract.image_to_string(img)
                
                results["pages"].append({
                    "page_num": page_num + 1,
                    "text": text,
                    "confidence": 0.85 # Mock confidence for local OCR
                })
                
                # Simple question detection heuristic
                if "Q" in text or "Question" in text:
                    results["structured_records"].append({
                        "question_detected": True,
                        "page": page_num + 1
                    })
                    
        except Exception as e:
            results["metadata"]["error"] = str(e)
            
        return results

class ExternalDocumentIntelligenceProvider(DocumentIntelligenceProvider):
    def __init__(self):
        self.api_key = os.environ.get("DOC_INTEL_API_KEY")
        
    def process_document(self, file_bytes: bytes) -> Dict[str, Any]:
        if not self.api_key:
            raise ValueError("External Document Intelligence API key not configured.")
        # Make real API call to AWS Textract / Azure Form Recognizer here
        return {"provider": "External", "status": "processed"}

def get_document_intelligence() -> DocumentIntelligenceProvider:
    if os.environ.get("DOC_INTEL_API_KEY"):
        return ExternalDocumentIntelligenceProvider()
    return LocalDocumentIntelligenceProvider()
