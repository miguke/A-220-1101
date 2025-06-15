import json
import os
import re
import pdfplumber

# --- CONFIGURATION ---

# 1. Define the exam configuration you want to use.
#    Options: '1101_CORE_1', '1102_CORE_2'
SELECTED_CONFIG = '1101_CORE_1'

# 2. Specify the input PDF file.
INPUT_PDF_PATH = os.path.join(os.path.dirname(__file__), '..', "PDF's", '220-1101_3.pdf')

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

NEW_QUESTION_RE = re.compile(r'^NEW QUESTION \d+\s*', re.IGNORECASE)

def get_question_signature(question_obj):
    """Creates a unique signature for a question for deduplication."""
    # Remove NEW QUESTION n prefix and normalize
    question_text = question_obj.get("question", "")
    question_text = NEW_QUESTION_RE.sub('', question_text).strip().casefold()
    options = [str(opt).strip().casefold() for opt in question_obj.get("options", [])]
    sorted_options = sorted(options)
    return f"{question_text}|{'|'.join(sorted_options)}"

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
            answer_match = re.search(r'Answer:\s*([A-Z]+)', block, re.IGNORECASE)
            explanation_match = re.search(r'Explanation:(.*)', block, re.DOTALL | re.IGNORECASE)

            if not answer_match:
                print(f"Warning: Skipping block {i} due to missing answer.")
                continue

            # --- Isolate the main content (question + options) ---
            # We no longer look for the topic number as it's unreliable
            start_index = 0
            end_index = answer_match.start()
            content_block = block[start_index:end_index].strip()

            # --- Separate Question from Options ---
            # Options are assumed to start with a line beginning with "A."
            options_start_match = re.search(r'\nA\.', content_block)
            if not options_start_match:
                print(f"Warning: Skipping block {i} due to missing options start (A.).")
                continue
            
            # Extract the question text (remove the 'NEW QUESTION #' line)
            question_text = content_block.split('?', 1)[0] + '?'
            # Remove any '-(Topic X)' line that might be present
            question_text = re.sub(r'^\s*-\s*\(Topic\s+\d+\)\s*$', '', question_text, flags=re.MULTILINE).strip()
            # Remove the 'NEW QUESTION #' line
            question_text = re.sub(r'^NEW QUESTION \d+\s*', '', question_text, flags=re.MULTILINE).strip()
            options_block_raw = content_block[options_start_match.start():].strip()

            # Skip DRAG DROP, SIMULATION, and HOTSPOT questions
            if "DRAG DROP" in question_text or "SIMULATION" in question_text or "HOTSPOT" in question_text:
                print(f"Skipping block {i} because it is a DRAG DROP, SIMULATION, or HOTSPOT question")
                continue
            
            # --- Process Options ---
            # Split into a list of options, handling multi-line options
            option_splits = re.split(r'\n(?=[B-Z]\.)', options_block_raw)
            cleaned_options = [
                re.sub(r'^[A-Z]\.\s*', '', opt.replace('\n', ' ').strip()).strip()
                for opt in option_splits
            ]

            # Clean spam from options
            spam_pattern = re.compile(r'Passing Certification Exams Made Easy visit - https://www\.2PassEasy\.com Welcome to download the Newest 2passeasy 220-1101 dumps https://www\.2passeasy\.com/dumps/220-1101/ \(443 New Questions\)')
            cleaned_options = [spam_pattern.sub('', opt).strip() for opt in cleaned_options]

            # --- Format final object ---
            answer_str = answer_match.group(1)
            explanation = explanation_match.group(1).strip() if explanation_match else ""
            correct_indices = [ord(char.upper()) - ord('A') for char in answer_str]

            question_obj = {
                "id": -1, # Will be reassigned later if merged
                "question": question_text,
                "options": cleaned_options,
                "correct": correct_indices,
                "explanation": explanation,
                "source_pdf": os.path.basename(pdf_filename)
                # We remove 'source_topic_id' because we'll categorize by content
            }
            parsed_questions.append(question_obj)

        except Exception as e:
            print(f"Error parsing question block {i}. Error: {e}\nBlock content: {block[:150]}...\n")

    return parsed_questions

def categorize_question(question_text, explanation):
    """Categorize a question into a domain based on its content."""
    # Combine the question and explanation for better context
    content = (question_text + " " + explanation).lower()
    
    # Define keywords for each domain with weights
    # The weights are arbitrary but help in scoring
    keywords = {
        'hardware': [
            ('ram', 2), ('cpu', 2), ('motherboard', 3), ('hard drive', 2), ('ssd', 2),
            ('power supply', 2), ('gpu', 2), ('cooling', 1), ('desktop', 1), ('printer', 1)
        ],
        'networking': [
            ('router', 2), ('switch', 2), ('firewall', 2), ('wifi', 2), ('ethernet', 2),
            ('tcp/ip', 2), ('dns', 2), ('vpn', 2), ('lan', 2), ('wan', 2), ('port', 1)
        ],
        'mobile-devices': [
            ('laptop', 2), ('tablet', 2), ('smartphone', 2), ('battery', 1), ('touch screen', 1),
            ('mobile device', 2), ('usb-c', 1), ('nfc', 1), ('bluetooth', 1), ('tablet', 1)
        ],
        'troubleshooting': [
            ('troubleshoot', 3), ('error', 2), ('fix', 2), ('issue', 2), ('problem', 2),
            ('not working', 2), ('resolve', 2), ('diagnose', 2), ('repair', 2), ('symptom', 2)
        ],
        'virtualization-cloud': [
            ('virtual', 3), ('vm', 3), ('cloud', 3), ('hypervisor', 3), ('iaas', 2),
            ('paas', 2), ('saas', 2), ('vdi', 2), ('server', 1), ('host', 1)
        ]
    }
    
    # Initialize scores for each domain
    scores = {domain: 0 for domain in keywords}
    
    # Score the content based on keyword matches
    for domain, terms in keywords.items():
        for (keyword, weight) in terms:
            if keyword in content:
                scores[domain] += weight
    
    # Find the domain with the highest score
    best_domain = max(scores, key=scores.get)
    
    # Only return the best domain if its score is above a threshold
    if scores[best_domain] >= 2:  # At least one significant match
        return best_domain
    else:
        return 'miscellaneous'

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

    # 4. Filter out duplicates and assign topics by content
    new_unique_questions = []
    misc_topic_name = 'miscellaneous'

    for q in extracted_questions:
        signature = get_question_signature(q)
        if signature not in existing_signatures:
            # Categorize the question based on its content
            topic = categorize_question(q['question'], q.get('explanation', ''))
            q['topic'] = topic
            
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
