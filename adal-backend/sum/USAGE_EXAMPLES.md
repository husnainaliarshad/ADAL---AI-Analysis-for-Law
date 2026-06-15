# Usage Examples

## Generate Both Summaries (Recommended)

To generate both a detailed summary and a short paragraph summary at once:

```powershell
python legal_summarizer.py legal.txt --both
```

This will create:
- `legal_summary_detailed.txt` - Full comprehensive summary
- `legal_summary_short.txt` - Very short paragraph (3-5 sentences)

## Generate Only Detailed Summary (Default)

```powershell
python legal_summarizer.py legal.txt
```

Creates: `legal_summary.txt`

## Generate Only Short Summary

```powershell
python legal_summarizer.py legal.txt --short
```

Creates: `legal_summary_short.txt` (3-5 sentence paragraph)

## Custom Output Files

```powershell
# Both summaries with custom names
python legal_summarizer.py legal.txt --both -o my_summaries

# Single summary with custom name
python legal_summarizer.py legal.txt -o my_summary.txt
```

## Using in Python Code

```python
from legal_summarizer import LegalSummarizer

summarizer = LegalSummarizer()

# Generate both summaries
detailed, short = summarizer.generate_both_summaries_from_file("legal.txt")

# Or generate separately
detailed = summarizer.summarize_from_file("legal.txt", short=False)
short = summarizer.summarize_from_file("legal.txt", short=True)
```

