"""
Local-only legal summarizer
Does NOT call external APIs. Uses a simple heuristic to keep a short,
readable slice of the provided legal text. Intended for offline/demo use.
"""

from typing import Tuple
import re


class LocalLegalSummarizer:
    """
    Heuristic, offline summarizer. It extracts the leading sentences and
    trims to a character budget. No network/API usage.
    """

    def __init__(self, max_chars: int = 1200, short_max_chars: int = 400):
        self.max_chars = max_chars
        self.short_max_chars = short_max_chars

    def _clean(self, text: str) -> str:
        if not text:
            return ""
        # Collapse whitespace and normalize spacing
        text = re.sub(r"\s+", " ", text).strip()
        return text

    def _take_sentences(self, text: str, char_limit: int) -> str:
        text = self._clean(text)
        if len(text) <= char_limit:
            return text
        # Split on sentence-ending punctuation; keep until limit reached
        sentences = re.split(r"(?<=[.!?])\s+", text)
        out = []
        total = 0
        for s in sentences:
            if not s:
                continue
            if total + len(s) > char_limit:
                break
            out.append(s)
            total += len(s) + 1
        if not out:
            return text[:char_limit].rstrip()
        return " ".join(out).strip()

    def summarize(self, legal_text: str, short: bool = False) -> str:
        """
        Heuristic summary: take the first few sentences within a character budget.
        """
        if not legal_text or not legal_text.strip():
            return "No content to summarize."
        limit = self.short_max_chars if short else self.max_chars
        return self._take_sentences(legal_text, limit)

    def generate_both_summaries(self, legal_text: str) -> Tuple[str, str]:
        detailed = self.summarize(legal_text, short=False)
        short = self.summarize(legal_text, short=True)
        return detailed, short


if __name__ == "__main__":
    sample = """
    IN THE SUPREME COURT OF PAKISTAN (Appellate Jurisdiction)
    This appeal concerns contractual obligations and the applicability of
    relevant statutes. The appellant challenges the lower court's findings
    on breach and damages. The Court reviews the evidence, statutory
    provisions, and precedents before issuing its determination.
    """
    summarizer = LocalLegalSummarizer()
    print("Detailed:\n", summarizer.summarize(sample))
    print("\nShort:\n", summarizer.summarize(sample, short=True))

