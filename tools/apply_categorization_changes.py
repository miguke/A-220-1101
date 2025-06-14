import json
import os
from collections import OrderedDict

# Configuration
DATA_DIR = os.path.join("..", "data", "1101")
TOPIC_FILES = {
    "hardware": "hardware.json",
    "mobile-devices": "mobile-devices.json",
    "networking": "networking.json",
    "troubleshooting": "troubleshooting.json",
    "virtualization-cloud": "virtualization-cloud.json",
    "miscellaneous": "miscellaneous.json",
}

# Deletion list based on "Original File" and "Original Index"
# These indices are assumed to be 0-based for list operations
# and refer to the state of the files BEFORE this script runs.
DELETIONS = [
    {"original_file_key": "networking", "original_index": 245},
    {"original_file_key": "virtualization-cloud", "original_index": 301},
    {"original_file_key": "virtualization-cloud", "original_index": 304},
]

# Re-categorization list
# Indices are assumed to be 0-based.
REMOVES_AND_MOVES = [
    # From hardware.json
    {"original_file_key": "hardware", "original_index": 2, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 4, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 5, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 8, "target_topic_key": "mobile-devices"},
    {"original_file_key": "hardware", "original_index": 20, "target_topic_key": "mobile-devices"},
    {"original_file_key": "hardware", "original_index": 31, "target_topic_key": "networking"},
    {"original_file_key": "hardware", "original_index": 48, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 76, "target_topic_key": "networking"},
    {"original_file_key": "hardware", "original_index": 77, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 78, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 79, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 81, "target_topic_key": "networking"},
    {"original_file_key": "hardware", "original_index": 82, "target_topic_key": "networking"},
    # From networking.json
    {"original_file_key": "networking", "original_index": 246, "target_topic_key": "virtualization-cloud"},
    {"original_file_key": "networking", "original_index": 249, "target_topic_key": "mobile-devices"},
    {"original_file_key": "networking", "original_index": 250, "target_topic_key": "troubleshooting"},
    {"original_file_key": "networking", "original_index": 251, "target_topic_key": "troubleshooting"},
    {"original_file_key": "networking", "original_index": 252, "target_topic_key": "troubleshooting"},
    {"original_file_key": "networking", "original_index": 253, "target_topic_key": "virtualization-cloud"},
    {"original_file_key": "networking", "original_index": 254, "target_topic_key": "virtualization-cloud"},
]

def load_questions(data_dir, topic_files_map):
    """Loads all questions from JSON files."""
    all_questions_by_topic = {}
    for topic_key, filename in topic_files_map.items():
        filepath = os.path.join(data_dir, filename)
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                all_questions_by_topic[topic_key] = json.load(f)
        except FileNotFoundError:
            all_questions_by_topic[topic_key] = []
            print(f"Warning: File {filepath} not found. Starting with empty list for topic '{topic_key}'.")
        except json.JSONDecodeError:
            all_questions_by_topic[topic_key] = []
            print(f"Warning: File {filepath} is not valid JSON. Starting with empty list for topic '{topic_key}'.")
    return all_questions_by_topic

def get_question_signature(question_obj):
    """Creates a unique signature for a question for deduplication."""
    if not isinstance(question_obj, dict) or "question" not in question_obj or "options" not in question_obj:
        # Return a unique, non-matching signature for malformed objects
        return f"malformed_{id(question_obj)}" 
    
    question_text = question_obj.get("question", "").strip()
    options = sorted([str(opt).strip() for opt in question_obj.get("options", [])])
    return f"{question_text}|{'|'.join(options)}"

def apply_changes(all_questions_by_topic, deletions, moves):
    """Applies deletions and moves.
    This version assumes indices refer to the state of the files *before* this run.
    It's tricky because modifications shift indices.
    A more robust way would be to identify questions by content if original indices are unreliable.
    For this implementation, we'll process deletions first, then moves, being mindful of index shifts.
    """
    
    questions_to_move = [] # Store (question_obj, target_topic_key)

    # Phase 1: Identify questions for deletion and moves based on *current* indices
    # We sort by index descending to minimize impact of removals on subsequent indices in the same file.
    
    # Deletions
    # Group deletions by file and sort by index descending
    deletions_by_file = {}
    for item in deletions:
        key = item['original_file_key']
        if key not in deletions_by_file:
            deletions_by_file[key] = []
        deletions_by_file[key].append(item['original_index'])
    
    for file_key in deletions_by_file:
        deletions_by_file[file_key].sort(reverse=True)
        if file_key in all_questions_by_topic:
            for index_to_delete in deletions_by_file[file_key]:
                if 0 <= index_to_delete < len(all_questions_by_topic[file_key]):
                    print(f"Deleting from {file_key}, index {index_to_delete}")
                    del all_questions_by_topic[file_key][index_to_delete]
                else:
                    print(f"Warning: Deletion index {index_to_delete} out of bounds for {file_key}")
        else:
            print(f"Warning: File key {file_key} for deletion not found in loaded questions.")


    # Moves
    # Group moves by file and sort by index descending to correctly pop items
    moves_grouped_by_file = {}
    for move_item in moves:
        file_key = move_item['original_file_key']
        if file_key not in moves_grouped_by_file:
            moves_grouped_by_file[file_key] = []
        moves_grouped_by_file[file_key].append(move_item)

    for file_key in moves_grouped_by_file:
        # Sort by original_index in descending order to avoid index shifting issues during pop
        sorted_moves = sorted(moves_grouped_by_file[file_key], key=lambda x: x['original_index'], reverse=True)
        
        if file_key in all_questions_by_topic:
            for move_item in sorted_moves:
                original_index = move_item['original_index']
                target_topic_key = move_item['target_topic_key']
                if 0 <= original_index < len(all_questions_by_topic[file_key]):
                    question_to_move = all_questions_by_topic[file_key].pop(original_index)
                    questions_to_move.append((question_to_move, target_topic_key))
                    print(f"Marked to move from {file_key} (orig index {original_index}) to {target_topic_key}")
                else:
                    print(f"Warning: Move index {original_index} out of bounds for {file_key}. Question: {move_item}")
        else:
            print(f"Warning: File key {file_key} for move not found in loaded questions.")

    # Phase 2: Add moved questions to their target topics
    for question, target_key in questions_to_move:
        if target_key not in all_questions_by_topic:
            all_questions_by_topic[target_key] = []
        all_questions_by_topic[target_key].append(question)
        print(f"Added question to {target_key} list.")

    return all_questions_by_topic


def finalize_questions(all_questions_by_topic):
    """Deduplicates, removes 'topic' field, and re-assigns IDs."""
    final_data = OrderedDict() # Keep topic order somewhat consistent
    processed_signatures = set()

    # Initialize final_data with all topic keys to ensure all files are written
    for key in TOPIC_FILES.keys():
        final_data[key] = []

    # Process topics in a defined order (e.g., as in TOPIC_FILES)
    # This helps make deduplication more predictable if a question could belong to multiple after moves
    for topic_key in TOPIC_FILES.keys():
        if topic_key not in all_questions_by_topic:
            print(f"Topic key {topic_key} not found in all_questions_by_topic during finalization. Ensuring empty list.")
            all_questions_by_topic[topic_key] = [] # Ensure it exists for processing

        current_topic_questions = []
        topic_signatures = set() # Signatures for questions already added to *this* topic

        for q_idx, question in enumerate(all_questions_by_topic.get(topic_key, [])):
            if not isinstance(question, dict):
                print(f"Warning: Skipping malformed question data (not a dict) in {topic_key} at index {q_idx}: {question}")
                continue

            # Remove 'topic' field
            if 'topic' in question:
                del question['topic']
            
            # Deduplication within the entire dataset
            signature = get_question_signature(question)
            if signature not in processed_signatures:
                current_topic_questions.append(question)
                processed_signatures.add(signature)
                topic_signatures.add(signature) # also add to topic specific for good measure
            else:
                # If it's a duplicate of something already processed globally, skip it.
                print(f"Skipping global duplicate in {topic_key}: {question.get('question', 'N/A')[:50]}...")
                
        # Re-assign IDs
        for i, question_obj in enumerate(current_topic_questions):
            question_obj['id'] = i + 1
        
        final_data[topic_key] = current_topic_questions
        
    return final_data

def save_questions(data_dir, final_data_map, topic_files_map):
    """Saves the processed questions back to JSON files."""
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
        print(f"Created directory: {data_dir}")

    for topic_key, questions_list in final_data_map.items():
        filename = topic_files_map.get(topic_key)
        if not filename:
            print(f"Warning: No filename defined for topic key '{topic_key}'. Skipping save.")
            continue
        
        filepath = os.path.join(data_dir, filename)
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(questions_list, f, indent=2)
            print(f"Successfully wrote {len(questions_list)} questions to {filepath}")
        except Exception as e:
            print(f"Error writing to {filepath}: {e}")


def main():
    print("Starting question processing...")
    
    # 1. Load all current questions
    all_current_questions = load_questions(DATA_DIR, TOPIC_FILES)
    
    # Print initial counts
    print("\nInitial question counts per topic:")
    for key, val_list in all_current_questions.items():
        print(f"- {key}: {len(val_list)}")

    # 2. Apply explicit deletions and re-categorizations
    # This modifies all_current_questions in place for moves, and directly for deletions
    print("\nApplying explicit deletions and re-categorizations...")
    all_current_questions = apply_changes(all_current_questions, DELETIONS, REMOVES_AND_MOVES)

    # Print counts after moves/deletions
    print("\nQuestion counts after explicit changes (before final deduplication/ID reset):")
    for key, val_list in all_current_questions.items():
        print(f"- {key}: {len(val_list)}")

    # 3. Finalize: Secondary deduplication, remove 'topic' field, re-assign IDs
    print("\nFinalizing questions (secondary deduplication, ID reset)...")
    final_output_data = finalize_questions(all_current_questions)

    # 4. Save processed questions
    print("\nSaving processed questions...")
    save_questions(DATA_DIR, final_output_data, TOPIC_FILES)

    print("\nQuestion processing complete.")
    print("Final question counts per topic:")
    for key, val_list in final_output_data.items():
        print(f"- {key}: {len(val_list)}")

if __name__ == "__main__":
    main()