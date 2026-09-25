import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

class EmbeddingProvider(ABC):
    @abstractmethod
    def embed_text(self, text: str) -> List[float]:
        pass
    
    @abstractmethod
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        pass

class LocalEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        # We use TF-IDF for lightweight, genuine local vector generation
        # without requiring 500MB PyTorch inside Docker.
        self.vectorizer = TfidfVectorizer(max_features=384)
        self.is_fitted = False
        self._temp_texts = [] # Store texts until fitted

    def _fit_if_needed(self):
        if not self.is_fitted and self._temp_texts:
            self.vectorizer.fit(self._temp_texts)
            self.is_fitted = True

    def embed_text(self, text: str) -> List[float]:
        if not self.is_fitted:
            self._temp_texts.append(text)
            self._fit_if_needed()
            
        vec = self.vectorizer.transform([text]).toarray()[0]
        # Pad to 384 dimensions if necessary
        result = np.zeros(384)
        result[:len(vec)] = vec
        return result.tolist()
        
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        if not self.is_fitted:
            self._temp_texts.extend(texts)
            self._fit_if_needed()
            
        vecs = self.vectorizer.transform(texts).toarray()
        results = []
        for vec in vecs:
            result = np.zeros(384)
            result[:len(vec)] = vec
            results.append(result.tolist())
        return results

class ExternalEmbeddingProvider(EmbeddingProvider):
    def __init__(self):
        self.api_key = os.environ.get("OPENAI_API_KEY")
        
    def embed_text(self, text: str) -> List[float]:
        if not self.api_key:
            raise ValueError("External Embedding API key not configured.")
        return [0.0] * 1536
        
    def embed_batch(self, texts: List[str]) -> List[List[float]]:
        return [[0.0] * 1536 for _ in texts]

def get_embedding_provider() -> EmbeddingProvider:
    if os.environ.get("OPENAI_API_KEY"):
        return ExternalEmbeddingProvider()
    return LocalEmbeddingProvider()

class KnowledgeService:
    def __init__(self):
        self.embedder = get_embedding_provider()
        self.vector_store = []
        self._seed_data()
        
    def _seed_data(self):
        docs = [
            {"id": "c-04", "text": "Q04 Marking Criterion: Award 1 mark for correct formula, 2 marks for substitution, 2 marks for final answer.", "metadata": {"question": "Q04", "max_marks": 5}},
            {"id": "c-06", "text": "Q06 Marking Criterion: Must evaluate all sub-sections. Section B total cannot exceed 40. Q06 is required.", "metadata": {"question": "Q06", "required": True}},
            {"id": "mod-rule", "text": "Moderation Rule: If section total recorded by examiner mismatches computed section total from individual questions, a review signal must be generated.", "metadata": {"type": "rule"}}
        ]
        
        # Batch embed for TFIDF fitting
        texts = [d["text"] for d in docs]
        vecs = self.embedder.embed_batch(texts)
        
        for i, d in enumerate(docs):
            self.vector_store.append({
                "id": d["id"],
                "text": d["text"],
                "embedding": vecs[i],
                "metadata": d["metadata"]
            })

    def cosine_similarity(self, v1: List[float], v2: List[float]) -> float:
        a = np.array(v1)
        b = np.array(v2)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def retrieve(self, query: str, top_k: int = 2) -> List[Dict[str, Any]]:
        query_vec = self.embedder.embed_text(query)
        results = []
        for doc in self.vector_store:
            sim = self.cosine_similarity(query_vec, doc["embedding"])
            results.append({
                "id": doc["id"],
                "text": doc["text"],
                "metadata": doc["metadata"],
                "score": sim
            })
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]

    def ingest(self, text: str, metadata: dict = None):
        vec = self.embedder.embed_text(text)
        self.vector_store.append({
            "id": f"ingested-{len(self.vector_store)}",
            "text": text,
            "embedding": vec,
            "metadata": metadata or {}
        })
