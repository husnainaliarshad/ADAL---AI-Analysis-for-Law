import os
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS", "1")

from pathlib import Path
from transformers import AutoTokenizer, AutoModel
from sentence_transformers import SentenceTransformer

# Same exact cache dir as claim_service.py
DATA_ROOT = Path("../Data").resolve()
HF_MODEL_CACHE_DIR = DATA_ROOT / "hf_models"
HF_MODEL_CACHE_DIR.mkdir(parents=True, exist_ok=True)

model_name = "law-ai/InLegalBERT"
print(f"Downloading {model_name} to {HF_MODEL_CACHE_DIR}...")
tokenizer = AutoTokenizer.from_pretrained(model_name, cache_dir=str(HF_MODEL_CACHE_DIR))
model = AutoModel.from_pretrained(model_name, cache_dir=str(HF_MODEL_CACHE_DIR))

emb_model_name = "BAAI/bge-m3"
print(f"Downloading {emb_model_name} to {HF_MODEL_CACHE_DIR}...")
emb_model = SentenceTransformer(emb_model_name, cache_folder=str(HF_MODEL_CACHE_DIR))

print("Download complete and cached successfully!")
