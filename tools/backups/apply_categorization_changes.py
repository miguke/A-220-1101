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
# These indices are 0-based for list operations
# and refer to the state of the files BEFORE this script runs.
# Note: All previous deletions have been removed as they referenced non-existent questions
DELETIONS = []

# Re-categorization list
# Indices are 0-based and have been verified against current question counts
REMOVES_AND_MOVES = [
    # From hardware.json
    {"original_file_key": "hardware", "original_index": 2, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 4, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 5, "target_topic_key": "troubleshooting"},
    {"original_file_key": "hardware", "original_index": 8, "target_topic_key": "mobile-devices"},
    {"original_file_key": "hardware", "original_index": 20, "target_topic_key": "mobile-devices"},
    {"original_file_key": "hardware", "original_index": 31, "target_topic_key": "networking"},
    {"original_file_key": "hardware", "original_index": 48, "target_topic_key": "troubleshooting"},
    # Note: Removed operations with indices >= 76 as they're out of bounds for hardware.json
    
    # Note: Removed all networking.json operations as they were out of bounds
    # (networking.json only has 67 questions, but operations referenced indices 246-254)
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

def filter_valid_operations(operations, all_questions_by_topic, operation_type):
    """Filter out operations that reference non-existent questions."""
    valid_ops = []
    skipped_ops = []
    
    for op in operations:
        topic_key = op['original_file_key']
        idx = op['original_index']
        
        if topic_key not in all_questions_by_topic:
            print(f"Warning: Topic '{topic_key}' not found in question bank. Skipping {operation_type} operation.")
            skipped_ops.append(op)
            continue
            
        questions = all_questions_by_topic[topic_key]
        if idx < 0 or idx >= len(questions):
            print(f"Warning: Index {idx} out of bounds for topic '{topic_key}' (has {len(questions)} questions). "
                  f"Skipping {operation_type} operation.")
            skipped_ops.append(op)
        else:
            valid_ops.append(op)
    
    return valid_ops, skipped_ops

def apply_changes(all_questions_by_topic, deletions, moves):
    """Applies deletions and moves.
    This version handles out-of-bounds indices gracefully and provides better logging.
    """
    # Filter out invalid operations
    valid_deletions, skipped_deletions = filter_valid_operations(
        deletions, all_questions_by_topic, "deletion")
    valid_moves, skipped_moves = filter_valid_operations(
        moves, all_questions_by_topic, "move")
    
    print(f"\nApplying {len(valid_deletions)} valid deletions and {len(valid_moves)} valid move operations...")
    if skipped_deletions or skipped_moves:
        print(f"Warning: Skipped {len(skipped_deletions) + len(skipped_moves)} operations due to invalid indices.")
    
    questions_to_move = []  # Store (question_obj, target_topic_key)

    # Phase 1: Process deletions first
    # Group valid deletions by file and sort by index descending
    deletions_by_file = {}
    for item in valid_deletions:
        key = item['original_file_key']
        if key not in deletions_by_file:
            deletions_by_file[key] = []
        deletions_by_file[key].append(item['original_index'])
        
    # Sort indices in descending order for each file to handle removals correctly
    for key in deletions_by_file:
        deletions_by_file[key] = sorted(deletions_by_file[key], reverse=True)
    
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

    # Phase 2: Process moves (after deletions)
    # Group valid moves by source file and sort by index descending
    moves_by_file = {}
    for item in valid_moves:
        key = item['original_file_key']
        if key not in moves_by_file:
            moves_by_file[key] = []
        moves_by_file[key].append((item['original_index'], item['target_topic_key']))
        
    # Sort moves by index in descending order for each file
    for key in moves_by_file:
        moves_by_file[key].sort(key=lambda x: x[0], reverse=True)
        
    for file_key in moves_by_file:
        if file_key in all_questions_by_topic:
            for move_item in moves_by_file[file_key]:
                original_index = move_item[0]
                target_topic_key = move_item[1]
                if 0 <= original_index < len(all_questions_by_topic[file_key]):
                    question_to_move = all_questions_by_topic[file_key].pop(original_index)
                    questions_to_move.append((question_to_move, target_topic_key))
                    print(f"Marked to move from {file_key} (orig index {original_index}) to {target_topic_key}")
                else:
                    print(f"Warning: Move index {original_index} out of bounds for {file_key}. Question: {move_item}")
        else:
            print(f"Warning: File key {file_key} for move not found in loaded questions.")

    # Phase 3: Add moved questions to their target topics
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
    print("Starting question processing...\n")
    
    # Load all questions
    all_questions_by_topic = load_questions(DATA_DIR, TOPIC_FILES)
    
    # Print initial counts
    print("Initial question counts per topic:")
    for topic, questions in all_questions_by_topic.items():
        print(f"- {topic}: {len(questions)}")
    print()
    
    # Print warnings for any obviously invalid operations before processing
    for op in DELETIONS + REMOVES_AND_MOVES:
        topic_key = op['original_file_key']
        idx = op['original_index']
        
        if topic_key not in all_questions_by_topic:
            print(f"Warning: Topic '{topic_key}' not found in question bank.")
            continue
            
        questions = all_questions_by_topic[topic_key]
        if idx < 0 or idx >= len(questions):
            print(f"Warning: Index {idx} out of bounds for topic '{topic_key}' (has {len(questions)} questions)")
    print()
    
    # 2. Apply explicit deletions and re-categorizations
    # This modifies all_current_questions in place for moves, and directly for deletions
    print("\nApplying explicit deletions and re-categorizations...")
    all_current_questions = apply_changes(all_questions_by_topic, DELETIONS, REMOVES_AND_MOVES)

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