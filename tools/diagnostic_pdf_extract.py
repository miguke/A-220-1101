import pdfplumber

pdf_path = "PDF's/220-1101_3.pdf"
try:
    with pdfplumber.open(pdf_path) as pdf:
        all_text = ""
        for page in pdf.pages:
            all_text += page.extract_text() or ""
    # Print only the first 1000 characters for inspection
    print("--- BEGIN RAW PDF TEXT (first 1000 chars) ---")
    print(all_text[:1000])
    print("--- END RAW PDF TEXT ---")
except Exception as e:
    print(f"Error reading PDF: {e}")
