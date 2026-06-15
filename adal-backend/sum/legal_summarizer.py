"""
Legal Summarization Assistant for Pakistani Law

This module provides functionality to summarize legal documents,
focusing on judgments, case facts, evidence, and applicable statutes.
"""

import os
import sys
from typing import Optional
from pathlib import Path

# Load environment variables from .env file if it exists
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    # python-dotenv not installed, continue without it
    pass


class LegalSummarizer:
    """
    A specialized assistant for summarizing Pakistani legal documents.
    Produces abstractive summaries focusing on case outcomes, facts,
    evidence, legal issues, and applicable statutes.
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "deepseek-chat"):
        """
        Initialize the legal summarizer.
        
        Args:
            api_key: API key for the LLM service (defaults to DEEPSEEK_API_KEY env var)
            model: Model name to use (default: "deepseek-chat")
        """
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY") or os.getenv("LLM_API_KEY")
        self.model = model or os.getenv("LLM_MODEL_NAME", "deepseek-chat")
        self._check_dependencies()
    
    def _check_dependencies(self):
        """Check if required dependencies are available."""
        try:
            import openai
        except ImportError:
            print("Error: openai package not found. Please install it using:")
            print("  pip install openai")
            sys.exit(1)
    
    def _get_summarization_prompt(self, legal_text: str, short: bool = False) -> str:
        """
        Generate a specialized prompt for legal document summarization.
        
        Args:
            legal_text: The extracted text from the legal PDF
            short: If True, generate a very short paragraph summary
            
        Returns:
            A formatted prompt for the LLM
        """
        if short:
            prompt = f"""You are a legal summarization assistant specialized in Pakistani law.

Your task is to produce a VERY SHORT abstractive summary (just one small paragraph, 3-5 sentences maximum) of the following legal document.

The summary must be extremely concise and include only:
- The case outcome/decision (if it is a judgment)
- The most critical fact or issue
- The key legal principle or statute involved

Guidelines:
- Maximum 3-5 sentences in a single paragraph
- Be extremely brief and to the point
- Focus only on the most essential information
- Do not provide legal advice
- Use professional legal language appropriate for Pakistani law

Legal Document Text:
{legal_text}

Provide a very short paragraph summary (3-5 sentences maximum):"""
        else:
            prompt = f"""You are a legal summarization assistant specialized in Pakistani law.

Your task is to produce an abstractive summary (not copy-paste) of the following legal document.

Focus on:
1. The outcome/result of the case (if it is a judgment)
2. Key facts
3. Important evidence or legal issues
4. Applicable statutes/citations
5. What the reader must understand quickly

Guidelines:
- Keep the summary clear, concise, and neutral
- Do not provide legal advice
- Use professional legal language appropriate for Pakistani law
- Structure the summary with clear sections if helpful
- Extract and list all relevant case citations, statutes, and legal references
- If this is a judgment, clearly state the final decision/outcome

Legal Document Text:
{legal_text}

Please provide a comprehensive but concise summary following the above guidelines:"""
        
        return prompt
    
    def summarize(self, legal_text: str, max_tokens: int = None, short: bool = False) -> str:
        """
        Generate an abstractive summary of the legal document.
        
        Args:
            legal_text: The full text extracted from the legal PDF
            max_tokens: Maximum tokens for the summary (default: 2000, or 300 for short)
            short: If True, generate a very short paragraph summary (default: False)
            
        Returns:
            A formatted summary of the legal document
        """
        if not self.api_key:
            raise ValueError(
                "API key not provided. Set DEEPSEEK_API_KEY environment variable "
                "or pass api_key parameter."
            )
        
        # Set default max_tokens if not provided
        if max_tokens is None:
            max_tokens = 300 if short else 2000
        
        try:
            import openai
            
            client = openai.OpenAI(
                api_key=self.api_key,
                base_url="https://api.deepseek.com",
            )
            
            prompt = self._get_summarization_prompt(legal_text, short=short)
            
            system_message = "You are a legal summarization assistant specialized in Pakistani law. "
            if short:
                system_message += "You provide extremely brief, concise paragraph summaries of legal documents."
            else:
                system_message += "You provide clear, concise, and neutral summaries of legal documents."
            
            response = client.chat.completions.create(
                model=self.model,
                messages=[
                    {
                        "role": "system",
                        "content": system_message
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                max_tokens=max_tokens,
                temperature=0.3  # Lower temperature for more factual, consistent output
            )
            
            summary = response.choices[0].message.content.strip()
            return summary
            
        except Exception as e:
            raise RuntimeError(f"Error generating summary: {str(e)}")
    
    def summarize_from_file(self, file_path: str, encoding: str = "utf-8", short: bool = False) -> str:
        """
        Read legal text from a file and generate a summary.
        
        Args:
            file_path: Path to the text file containing legal document
            encoding: File encoding (default: "utf-8")
            short: If True, generate a very short paragraph summary (default: False)
            
        Returns:
            A formatted summary of the legal document
        """
        try:
            with open(file_path, "r", encoding=encoding) as f:
                legal_text = f.read()
            
            return self.summarize(legal_text, short=short)
            
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: {file_path}")
        except Exception as e:
            raise RuntimeError(f"Error reading file: {str(e)}")
    
    def generate_both_summaries(self, legal_text: str) -> tuple[str, str]:
        """
        Generate both detailed and short summaries.
        
        Args:
            legal_text: The full text extracted from the legal PDF
            
        Returns:
            A tuple of (detailed_summary, short_summary)
        """
        detailed = self.summarize(legal_text, short=False)
        short = self.summarize(legal_text, short=True)
        return (detailed, short)
    
    def generate_both_summaries_from_file(self, file_path: str, encoding: str = "utf-8") -> tuple[str, str]:
        """
        Read legal text from a file and generate both detailed and short summaries.
        
        Args:
            file_path: Path to the text file containing legal document
            encoding: File encoding (default: "utf-8")
            
        Returns:
            A tuple of (detailed_summary, short_summary)
        """
        try:
            with open(file_path, "r", encoding=encoding) as f:
                legal_text = f.read()
            
            return self.generate_both_summaries(legal_text)
            
        except FileNotFoundError:
            raise FileNotFoundError(f"File not found: {file_path}")
        except Exception as e:
            raise RuntimeError(f"Error reading file: {str(e)}")
    
    def save_summary(self, summary: str, output_path: str):
        """
        Save the summary to a file.
        
        Args:
            summary: The generated summary text
            output_path: Path where to save the summary
        """
        try:
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(summary)
            print(f"Summary saved to: {output_path}")
        except Exception as e:
            raise RuntimeError(f"Error saving summary: {str(e)}")


def main():
    """Command-line interface for the legal summarizer."""
    import argparse
    
    parser = argparse.ArgumentParser(
        description="Legal Summarization Assistant for Pakistani Law"
    )
    parser.add_argument(
        "input_file",
        help="Path to the text file containing legal document (extracted from PDF)"
    )
    parser.add_argument(
        "-o", "--output",
        help="Output file path for the summary (default: input_file_summary.txt)",
        default=None
    )
    parser.add_argument(
        "-k", "--api-key",
        help="DeepSeek API key (or set DEEPSEEK_API_KEY environment variable)",
        default=None
    )
    parser.add_argument(
        "-m", "--model",
        help="Model to use (default: deepseek-chat)",
        default="deepseek-chat"
    )
    parser.add_argument(
        "-t", "--max-tokens",
        help="Maximum tokens for summary (default: 2000, or 300 for short)",
        type=int,
        default=None
    )
    parser.add_argument(
        "-s", "--short",
        help="Generate a very short paragraph summary (3-5 sentences)",
        action="store_true"
    )
    parser.add_argument(
        "--both",
        help="Generate both detailed and short summaries",
        action="store_true"
    )
    
    args = parser.parse_args()
    
    try:
        # Initialize summarizer
        summarizer = LegalSummarizer(api_key=args.api_key, model=args.model)
        
        print(f"Reading legal document from: {args.input_file}")
        
        if args.both:
            # Generate both summaries
            print("Generating detailed and short summaries...")
            detailed_summary, short_summary = summarizer.generate_both_summaries_from_file(args.input_file)
            
            # Determine output paths
            if args.output is None:
                input_path = Path(args.input_file)
                detailed_path = input_path.parent / f"{input_path.stem}_summary_detailed.txt"
                short_path = input_path.parent / f"{input_path.stem}_summary_short.txt"
            else:
                output_path = Path(args.output)
                detailed_path = output_path.parent / f"{output_path.stem}_detailed.txt"
                short_path = output_path.parent / f"{output_path.stem}_short.txt"
            
            # Save both summaries
            summarizer.save_summary(detailed_summary, str(detailed_path))
            summarizer.save_summary(short_summary, str(short_path))
            
            # Print both summaries
            print("\n" + "="*80)
            print("DETAILED SUMMARY")
            print("="*80)
            print(detailed_summary)
            
            print("\n" + "="*80)
            print("SHORT SUMMARY")
            print("="*80)
            print(short_summary)
        else:
            # Generate single summary
            print("Generating summary...")
            
            # Determine output path
            if args.output is None:
                input_path = Path(args.input_file)
                suffix = "_summary_short" if args.short else "_summary"
                output_path = input_path.parent / f"{input_path.stem}{suffix}.txt"
            else:
                output_path = args.output
            
            # Set max_tokens if provided
            max_tokens = args.max_tokens if args.max_tokens is not None else (300 if args.short else 2000)
            
            # Generate summary
            summary = summarizer.summarize_from_file(args.input_file, short=args.short)
            
            # Save summary
            summarizer.save_summary(summary, str(output_path))
            
            # Also print to console
            summary_type = "SHORT SUMMARY" if args.short else "SUMMARY"
            print("\n" + "="*80)
            print(summary_type)
            print("="*80)
            print(summary)
        
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

