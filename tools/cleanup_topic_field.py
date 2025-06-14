import json
import os

def clean_topic_field(directory):
    """Remove the 'topic' field from all JSON files in the specified directory."""
    for filename in os.listdir(directory):
        if filename.endswith('.json'):
            filepath = os.path.join(directory, filename)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Track if any changes were made
                modified = False
                
                # Process each question
                for question in data:
                    if 'topic' in question:
                        del question['topic']
                        modified = True
                
                # Only write back if changes were made
                if modified:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        json.dump(data, f, indent=2, ensure_ascii=False)
                    print(f"Cleaned up 'topic' field in {filename}")
                else:
                    print(f"No changes needed for {filename}")
                    
            except Exception as e:
                print(f"Error processing {filename}: {str(e)}")

if __name__ == "__main__":
    data_dir = os.path.join('data', '1101')
    clean_topic_field(data_dir)
