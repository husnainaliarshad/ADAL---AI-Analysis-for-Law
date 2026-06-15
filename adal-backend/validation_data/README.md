# Validation Data Directory

This directory contains ground truth data for validating RAG pipeline components.

---

## File Structure

```
validation_data/
├── README.md (this file)
├── citation_ground_truth.json
├── claim_ground_truth.json
├── evidence_ground_truth.json
└── verification_ground_truth.json
```

---

## Citation Ground Truth Format

**File:** `citation_ground_truth.json`

```json
{
  "documents": [
    {
      "document_id": 4,
      "document_name": "sample_law.pdf",
      "citations": [
        {
          "citation_text": "PLD 2025 SC 123",
          "citation_type": "case",
          "position_start": 1234,
          "position_end": 1248,
          "jurisdiction": "PK",
          "court": "Supreme Court of Pakistan",
          "year": 2025,
          "reporter": "PLD",
          "page": 123
        }
      ]
    }
  ]
}
```

---

## Claim Ground Truth Format

**File:** `claim_ground_truth.json`

```json
{
  "documents": [
    {
      "document_id": 4,
      "document_name": "sample_law.pdf",
      "claims": [
        {
          "text": "Full claim text here...",
          "type": "constitutional",
          "position_start": 27246930,
          "position_end": 27247743,
          "has_citation": true,
          "citation_ids": [1, 2]
        }
      ]
    }
  ]
}
```

---

## Evidence Ground Truth Format

**File:** `evidence_ground_truth.json`

```json
{
  "claims": [
    {
      "claim_id": 53,
      "claim_text": "By the Unani, Ayurvedic...",
      "relevant_evidence": [
        {
          "document_filename": "C.A_supreme (1).txt",
          "paragraph_text": "Full paragraph text...",
          "relevance_score": 5,
          "reason": "Directly addresses the claim"
        }
      ]
    }
  ]
}
```

---

## Verification Ground Truth Format

**File:** `verification_ground_truth.json`

```json
{
  "claims": [
    {
      "claim_id": 53,
      "claim_text": "By the Unani, Ayurvedic...",
      "ground_truth": {
        "verdict": "supported",
        "confidence": 0.9,
        "expected_reasoning": "This claim is supported by...",
        "key_evidence_ids": [1, 2, 3],
        "should_cite": ["PLD 1982", "Ordinance XXVII of 1982"]
      }
    }
  ]
}
```

---

## How to Create Ground Truth

### Step 1: Select Test Documents

Choose 3-5 representative documents that cover:
- Different citation types (PLD, SCMR, PPC, etc.)
- Different claim types (criminal, civil, constitutional)
- Various document lengths

### Step 2: Manual Annotation

For each document:
1. Read through the document
2. Mark all citations with positions
3. Identify claim boundaries
4. Note relevant evidence
5. Determine expected verification results

### Step 3: Create JSON Files

Use the formats above to create ground truth files.

### Step 4: Validate

Run validation scripts:
```bash
python scripts/validate_citations.py
python scripts/validate_claims.py
python scripts/validate_evidence.py
python scripts/validate_verification.py
```

---

## Tips

- Start small: Begin with 1-2 documents
- Be consistent: Use same annotation style
- Document edge cases: Note unusual patterns
- Review regularly: Update ground truth as needed

