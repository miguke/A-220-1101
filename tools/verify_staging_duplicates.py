import json
import os
import re

NEW_QUESTION_RE = re.compile(r'^NEW QUESTION \d+\s*', re.IGNORECASE)

def get_question_signature(question_obj):
    """Creates a unique signature for a question for deduplication."""
    # Remove NEW QUESTION n prefix and normalize
    question_text = question_obj.get("question", "")
    question_text = NEW_QUESTION_RE.sub('', question_text).strip().casefold()
    options = [str(opt).strip().casefold() for opt in question_obj.get("options", [])]
    sorted_options = sorted(options)
    return f"{question_text}|{'|'.join(sorted_options)}"

def main():
    # Load existing signatures from all topic files
    data_dir = os.path.join('..', 'data', '1101')
    topic_files = [
        'hardware.json',
        'mobile-devices.json',
        'networking.json',
        'troubleshooting.json',
        'virtualization-cloud.json',
        'miscellaneous.json'
    ]

    existing_signatures = set()
    for filename in topic_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                questions = json.load(f)
                for q in questions:
                    existing_signatures.add(get_question_signature(q))

    # Load the staging file
    staging_file = os.path.join('..', 'new_questions_staging.json')
    if not os.path.exists(staging_file):
        print(f"Staging file not found: {staging_file}")
        return

    with open(staging_file, 'r', encoding='utf-8') as f:
        staging_questions = json.load(f)

    # Check for duplicates
    duplicate_indices = []
    for i, q in enumerate(staging_questions):
        sig = get_question_signature(q)
        if sig in existing_signatures:
            duplicate_indices.append(i)

    if duplicate_indices:
        print(f"Found {len(duplicate_indices)} duplicates in staging file.")
        print("Duplicate indices:", duplicate_indices)
    else:
        print("No duplicates found in staging file.")

if __name__ == '__main__':
    main()
