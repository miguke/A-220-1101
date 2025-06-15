import json
import os

def validate_questions(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        questions = json.load(f)
    
    print(f"Validating {len(questions)} questions in {os.path.basename(filepath)}")
    print("-" * 80)
    
    valid_count = 0
    invalid_questions = []
    
    for i, q in enumerate(questions, 1):
        errors = []
        
        if not q.get('question', '').strip():
            errors.append("Missing or empty question text")
            
        options = q.get('options', [])
        if not isinstance(options, list) or not options:
            errors.append("Missing or empty options array")
        else:
            for j, opt in enumerate(options):
                if not isinstance(opt, str) or not opt.strip():
                    errors.append(f"Invalid option at index {j}")
        
        correct = q.get('correct', [])
        if not isinstance(correct, list) or not correct:
            errors.append("Missing or empty correct answers array")
        else:
            for j, ans in enumerate(correct):
                if not isinstance(ans, int) or ans < 0 or ans >= len(options):
                    errors.append(f"Invalid correct answer index {ans} (options length: {len(options)})")
        
        if not q.get('id'):
            errors.append("Missing question ID")
            
        if not q.get('type') in ['single', 'multiple']:
            errors.append("Missing or invalid question type")
        
        if errors:
            invalid_questions.append({
                'index': i - 1,
                'id': q.get('id', 'N/A'),
                'errors': errors,
                'question_preview': (q.get('question') or '')[:100] + '...' if q.get('question') else 'EMPTY'
            })
        else:
            valid_count += 1
    
    print(f"Valid questions: {valid_count}/{len(questions)}")
    print(f"Invalid questions: {len(invalid_questions)}")
    
    if invalid_questions:
        print("\nFirst 5 invalid questions:")
        for iq in invalid_questions[:5]:
            print(f"\nQuestion #{iq['index'] + 1} (ID: {iq['id']})")
            print(f"Preview: {iq['question_preview']}")
            print("Errors:")
            for err in iq['errors']:
                print(f"  - {err}")
        
        if len(invalid_questions) > 5:
            print(f"\n... and {len(invalid_questions) - 5} more invalid questions.")
    
    return valid_count, invalid_questions

if __name__ == "__main__":
    # Get the directory where this script is located
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up one directory to the project root, then into data/1101
    project_root = os.path.dirname(script_dir)
    data_dir = os.path.join(project_root, 'data', '1101')
    
    # Validate all question files
    question_files = [
        'hardware.json',
        'mobile-devices.json',
        'networking.json',
        'troubleshooting.json',
        'virtualization-cloud.json',
        'miscellaneous.json'
    ]
    
    for q_file in question_files:
        file_path = os.path.join(data_dir, q_file)
        if os.path.exists(file_path):
            validate_questions(file_path)
        else:
            print(f"Warning: File not found: {file_path}")
