"""
Example usage of the Legal Summarization Assistant

This script demonstrates how to use the LegalSummarizer class
programmatically in your own Python code.
"""

from legal_summarizer import LegalSummarizer


def example_from_text():
    """Example: Summarize legal text directly from a string."""
    
    # Sample legal text (replace with actual extracted PDF text)
    sample_legal_text = """
    IN THE SUPREME COURT OF PAKISTAN
    
    (Appellate Jurisdiction)
    
    Civil Appeal No. 1234 of 2024
    
    Appellant: ABC Company Limited
    Respondent: XYZ Corporation
    
    JUDGMENT
    
    This appeal arises from the judgment dated 15th March 2023 passed by the 
    High Court of Lahore. The appellant challenges the decision regarding 
    contractual obligations under the Contract Act, 1872.
    
    FACTS:
    The parties entered into a service agreement on 1st January 2022. 
    The respondent failed to deliver services as per the agreed terms. 
    The appellant filed a suit for damages.
    
    ISSUES:
    1. Whether the contract was valid under Section 10 of the Contract Act, 1872?
    2. Whether the respondent breached the contract?
    3. What damages are recoverable?
    
    HELD:
    The contract was valid and enforceable. The respondent breached the 
    contract. The appellant is entitled to damages as claimed.
    
    The appeal is allowed. The judgment of the High Court is set aside.
    """
    
    # Initialize summarizer
    # Make sure to set OPENAPI_KEY environment variable or pass api_key parameter
    summarizer = LegalSummarizer()
    
    try:
        print("Generating summary from text...")
        summary = summarizer.summarize(sample_legal_text)
        
        print("\n" + "="*80)
        print("GENERATED SUMMARY")
        print("="*80)
        print(summary)
        
        # Save to file
        summarizer.save_summary(summary, "example_summary.txt")
        
    except ValueError as e:
        print(f"Error: {e}")
        print("\nPlease set your OpenAPI key:")
        print("  - Set OPENAPI_KEY environment variable, or")
        print("  - Pass api_key parameter: LegalSummarizer(api_key='your-key')")
    except Exception as e:
        print(f"Error generating summary: {e}")


def example_from_file():
    """Example: Summarize legal text from a file."""
    
    # Initialize summarizer
    summarizer = LegalSummarizer()
    
    try:
        # Replace with your actual legal document file path
        input_file = "legal_document.txt"
        
        print(f"Reading from file: {input_file}")
        print("Generating summary...")
        
        summary = summarizer.summarize_from_file(input_file)
        
        print("\n" + "="*80)
        print("GENERATED SUMMARY")
        print("="*80)
        print(summary)
        
        # Save to file
        output_file = "file_summary.txt"
        summarizer.save_summary(summary, output_file)
        
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Please ensure the input file exists.")
    except ValueError as e:
        print(f"Error: {e}")
        print("\nPlease set your OpenAPI key:")
        print("  - Set OPENAPI_KEY environment variable, or")
        print("  - Pass api_key parameter: LegalSummarizer(api_key='your-key')")
    except Exception as e:
        print(f"Error: {e}")


def example_with_custom_settings():
    """Example: Using custom model and token limits."""
    
    # Initialize with custom settings
    summarizer = LegalSummarizer(
        api_key="your-api-key-here",  # Or use environment variable
        model="gpt-3.5-turbo"  # Use faster/cheaper model
    )
    
    legal_text = "Your legal document text here..."
    
    try:
        # Generate summary with custom token limit
        summary = summarizer.summarize(legal_text, max_tokens=1500)
        print(summary)
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    print("Legal Summarization Assistant - Example Usage")
    print("="*80)
    print("\nChoose an example to run:")
    print("1. Summarize from text string")
    print("2. Summarize from file")
    print("3. Custom settings example")
    
    choice = input("\nEnter choice (1-3): ").strip()
    
    if choice == "1":
        example_from_text()
    elif choice == "2":
        example_from_file()
    elif choice == "3":
        example_with_custom_settings()
    else:
        print("Invalid choice. Running example 1...")
        example_from_text()

