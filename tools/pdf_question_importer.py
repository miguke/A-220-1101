import json
import os
import re
import pdfplumber

# --- CONFIGURATION ---

# 1. Define the exam configuration you want to use.
#    Options: '1101_CORE_1', '1102_CORE_2'
SELECTED_CONFIG = '1101_CORE_1'

# 2. Specify the input PDF file.
INPUT_PDF_PATH = os.path.join(os.path.dirname(__file__), '..', 'PDFs', '220-1101_3.pdf')

# 3. Specify the output file for newly extracted, unique questions.
#    The script will not modify your main topic files directly.
STAGING_OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'new_questions_staging.json')

# --- EXAM-SPECIFIC MAPPINGS ---

CONFIGURATIONS = {
    '1101_CORE_1': {
        'data_dir': os.path.join(os.path.dirname(__file__), '..', 'data', '1101'),
        'topic_map': {
            1: 'hardware',
            2: 'networking',
            3: 'mobile-devices',
            4: 'troubleshooting',
            5: 'virtualization-cloud',
        },
        'topic_files': [
            'hardware.json',
            'mobile-devices.json',
            'networking.json',
            'troubleshooting.json',
            'virtualization-cloud.json',
            'miscellaneous.json'
        ]
    },
    '1102_CORE_2': {
        'data_dir': os.path.join(os.path.dirname(__file__), '..', 'data', '1102'),
        'topic_map': {
            # TODO: Define the topic number to topic key mapping for 220-1102
            # Example:
            # 1: 'operating-systems',
            # 2: 'security',
            # 3: 'software-troubleshooting',
            # 4: 'operational-procedures',
        },
        'topic_files': [
            # TODO: Add the filenames for 220-1102 topics
        ]
    }
}

# --- SCRIPT LOGIC (WORK IN PROGRESS) ---

def get_question_signature(question_obj):
    """Creates a unique signature for a question for deduplication."""
    question_text = question_obj.get("question", "").strip()
    options = sorted([str(opt).strip() for opt in question_obj.get("options", [])])
    return f"{question_text}|{'|'.join(options)}"

def load_existing_signatures(config):
    """Loads signatures of all existing questions to avoid duplicates."""
    existing_signatures = set()
    data_dir = config['data_dir']
    topic_files = config['topic_files']

    for filename in topic_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    questions = json.load(f)
                    for q in questions:
                        existing_signatures.add(get_question_signature(q))
            except (json.JSONDecodeError, IOError) as e:
                print(f"Warning: Could not process {filepath}. Error: {e}")
    
    print(f"Loaded {len(existing_signatures)} existing question signatures for deduplication.")
    return existing_signatures

def extract_text_from_pdf(pdf_path):
    """Extracts all text from a given PDF file."""
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found at {pdf_path}")
        return None

    print(f"Reading text from {pdf_path}...")
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            full_text += page.extract_text() + "\n"
    return full_text

def parse_questions_from_text(text, pdf_filename):
    """Parses raw text from a PDF to extract structured question objects."""
    print("Parsing text to find question blocks...")

    # Use a robust split based on "NEW QUESTION" which acts as a reliable delimiter.
    # The first item is ignored as it's content before the first question.
    question_blocks = re.split(r'\nNEW QUESTION \d+', text)[1:]
    
    parsed_questions = []
    for i, block in enumerate(question_blocks, 1):
        try:
            # --- Extract individual fields using regex ---
            topic_match = re.search(r'-\s*Topic\s+(\d+)', block, re.IGNORECASE)
            answer_match = re.search(r'Answer:\s*([A-Z]+)', block, re.IGNORECASE)
            explanation_match = re.search(r'Explanation:(.*)', block, re.DOTALL | re.IGNORECASE)

            if not answer_match:
                print(f"Warning: Skipping block {i} due to missing answer.")
                continue

            # --- Isolate the main content (question + options) ---
            start_index = topic_match.end() if topic_match else 0
            end_index = answer_match.start()
            content_block = block[start_index:end_index].strip()

            # --- Separate Question from Options ---
            # Options are assumed to start with a line beginning with "A."
            options_start_match = re.search(r'\nA\.', content_block)
            if not options_start_match:
                print(f"Warning: Skipping block {i} due to missing options start (A.).")
                continue
            
            question_text = content_block[:options_start_match.start()].replace('\n', ' ').strip()
            options_block_raw = content_block[options_start_match.start():].strip()

            # --- Process Options ---
            # Split into a list of options, handling multi-line options
            option_splits = re.split(r'\n(?=[B-Z]\.)', options_block_raw)
            cleaned_options = [
                re.sub(r'^[A-Z]\.\s*', '', opt.replace('\n', ' ').strip()).strip()
                for opt in option_splits
            ]

            # --- Format final object ---
            topic_num = int(topic_match.group(1)) if topic_match else None
            answer_str = answer_match.group(1)
            explanation = explanation_match.group(1).strip() if explanation_match else ""
            correct_indices = [ord(char.upper()) - ord('A') for char in answer_str]

            question_obj = {
                "id": -1, # Will be reassigned later if merged
                "question": question_text,
                "options": cleaned_options,
                "correct": correct_indices,
                "explanation": explanation,
                "source_pdf": os.path.basename(pdf_filename),
                "source_topic_id": topic_num
            }
            parsed_questions.append(question_obj)

        except Exception as e:
            print(f"Error parsing question block {i}. Error: {e}\nBlock content: {block[:150]}...\n")

    return parsed_questions

def save_new_questions(questions, output_path):
    """Saves the list of new questions to the staging file."""
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(questions, f, indent=2)
        print(f"Successfully saved {len(questions)} new questions to {output_path}")
    except IOError as e:
        print(f"Error saving to staging file: {e}")

def main():
    """Main function to run the importer."""
    print(f"--- Starting PDF Question Importer ---")
    print(f"Using configuration: {SELECTED_CONFIG}")

    config = CONFIGURATIONS.get(SELECTED_CONFIG)
    if not config:
        print(f"Error: Configuration '{SELECTED_CONFIG}' not found.")
        return

    # 1. Load signatures of existing questions for deduplication
    existing_signatures = load_existing_signatures(config)

    # 2. Extract raw text from the source PDF
    raw_text = extract_text_from_pdf(INPUT_PDF_PATH)
    if not raw_text:
        return

    # 3. Parse the text to get question objects
    extracted_questions = parse_questions_from_text(raw_text, INPUT_PDF_PATH)

    # 4. Filter out duplicates and assign topics
    new_unique_questions = []
    topic_map = config['topic_map']
    misc_topic_name = 'miscellaneous'

    for q in extracted_questions:
        signature = get_question_signature(q)
        if signature not in existing_signatures:
            # Assign topic name for staging file review
            topic_num = q.get('source_topic_id')
            topic_name = topic_map.get(topic_num, misc_topic_name)
            q['topic'] = topic_name
            
            new_unique_questions.append(q)
            existing_signatures.add(signature) # Add to set to dedupe within the same PDF
    
    print(f"Found {len(extracted_questions)} questions in PDF, {len(new_unique_questions)} are new.")

    # 5. Save the new, unique questions to the staging file
    if new_unique_questions:
        save_new_questions(new_unique_questions, STAGING_OUTPUT_FILE)
    else:
        print("No new questions to save.")

    print("--- Importer finished ---")

if __name__ == "__main__":
    main()
