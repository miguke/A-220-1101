import json
import re
import os
from collections import Counter

# Define the mapping from the numeric topic in the JSON to the topic name
TOPIC_MAP = {
    1: 'Hardware',
    2: 'Networking',
    3: 'Mobile Devices',
    4: 'Virtualization & Cloud',
    5: 'Hardware & Network Troubleshooting'
}

# Define keywords for each topic
# These are case-insensitive
KEYWORD_SETS = {
    'Hardware': [
        'ram', 'cpu', 'motherboard', 'bios', 'uefi', 'cmos', 'power supply', 'psu', 'storage',
        'ssd', 'hdd', 'nvme', 'sata', 'raid', 'peripheral', 'connector', 'usb', 'hdmi', 'displayport',
        'printer', 'laser', 'inkjet', 'thermal', '3d printer', 'toner', 'pc', 'build', 'form factor',
        'atx', 'micro-atx', 'mini-itx', 'memory', 'dimm', 'so-dimm', 'ddr', 'multimeter', 'voltage'
    ],
    'Networking': [
        'network', 'ip address', 'subnet', 'tcp', 'udp', 'dns', 'dhcp', 'http', 'https', 'ftp', 'smb',
        'ethernet', 'rj45', 'rj11', 'switch', 'router', 'firewall', 'access point', 'ap', 'wlan',
        'wi-fi', '802.11', 'bluetooth', 'nfc', 'vpn', 'lan', 'wan', 'cable', 'fiber', 'coaxial', 'poe',
        'port', 'protocol', 'iot', 'server', 'client'
    ],
    'Mobile Devices': [
        'mobile', 'laptop', 'tablet', 'smartphone', 'ios', 'android', 'touchscreen', 'gps',
        'synchronization', 'sync', 'hotspot', 'tethering', 'imei', 'imsi', 'sim card', 'port replicator',
        'docking station'
    ],
    'Virtualization & Cloud': [
        'virtualization', 'vm', 'virtual machine', 'hypervisor', 'cloud', 'iaas', 'paas', 'saas',
        'public cloud', 'private cloud', 'hybrid cloud', 'vdi', 'virtual desktop', 'emulator',
        'resource pooling', 'on-demand'
    ],
    'Hardware & Network Troubleshooting': [
        'troubleshoot', 'problem', 'issue', 'error', 'no power', 'slow', 'intermittent', 'no signal',
        'ipconfig', 'ping', 'tracert', 'netstat', 'nslookup', 'loopback', 'toner probe', 'cable tester',
        'power failure', 'rebooting', 'not booting', 'bsod', 'blue screen', 'pinwheel', 'unexpected shutdown',
        'no connectivity', 'limited connectivity', 'apippa', 'ip conflict', 'cannot print'
    ]
}

def analyze_question_topic(question_data):
    """Analyzes a single question's text and explanation to suggest a topic."""
    text_to_analyze = (question_data.get('question', '') + ' ' + question_data.get('explanation', '')).lower()
    
    found_keywords = {topic: [] for topic in KEYWORD_SETS}
    topic_scores = Counter()

    # --- Contextual Analysis --- 
    # High-priority check for mobile device context
    is_mobile_context = False
    for keyword in KEYWORD_SETS['Mobile Devices']:
        if re.search(r'\b' + re.escape(keyword) + r'\b', text_to_analyze):
            is_mobile_context = True
            break

    # --- Keyword Scoring --- 
    for topic, keywords in KEYWORD_SETS.items():
        for keyword in keywords:
            if re.search(r'\b' + re.escape(keyword) + r'\b', text_to_analyze):
                # **Weighted Logic**
                # Give troubleshooting keywords a much higher score
                if topic == 'Hardware & Network Troubleshooting':
                    topic_scores[topic] += 5
                else:
                    topic_scores[topic] += 1
                found_keywords[topic].append(keyword)

    if not topic_scores:
        return 'Uncategorized', {}

    # --- Final Decision Logic --- 
    # If it's a mobile context and Mobile Devices has any score, it's the top candidate.
    if is_mobile_context and topic_scores['Mobile Devices'] > 0:
        # But, if troubleshooting score is much higher, it might be a mobile troubleshooting question.
        # For now, we will assume mobile context is king unless it's a clear troubleshooting issue.
        if topic_scores['Hardware & Network Troubleshooting'] >= 5: # At least one troubleshooting keyword
             # Let's check if the mobile score is just incidental
             if topic_scores['Mobile Devices'] <= 2 and topic_scores['Hardware & Network Troubleshooting'] > topic_scores['Mobile Devices']:
                 suggested_topic = 'Hardware & Network Troubleshooting'
             else:
                suggested_topic = 'Mobile Devices'
        else:
            suggested_topic = 'Mobile Devices'
    else:
        # If not mobile, the highest score wins.
        # Check if the top two scores are troubleshooting and a related topic
        top_two = topic_scores.most_common(2)
        if len(top_two) == 2:
            (topic1, score1), (topic2, score2) = top_two
            # If troubleshooting is the top score, and the second score is hardware/networking, it's definitely troubleshooting
            if topic1 == 'Hardware & Network Troubleshooting' and topic2 in ['Hardware', 'Networking']:
                suggested_topic = 'Hardware & Network Troubleshooting'
            # If hardware/networking is top, but troubleshooting is a close second, it's still troubleshooting
            elif topic1 in ['Hardware', 'Networking'] and topic2 == 'Hardware & Network Troubleshooting' and score1 < score2 * 2:
                 suggested_topic = 'Hardware & Network Troubleshooting'
            else:
                suggested_topic = topic1
        elif top_two:
            suggested_topic = top_two[0][0]
        else:
            suggested_topic = 'Uncategorized'

    # Consolidate found keywords from the winning topic
    final_keywords = found_keywords.get(suggested_topic, [])

    return suggested_topic, final_keywords

def get_topic_name_from_filename(filename):
    """Derives topic name from filename, e.g., hardware.json -> Hardware."""
    base = os.path.basename(filename)
    if 'new_questions' in base:
        return 'New Questions File'
    return TOPIC_MAP.get(int(base.split('_')[0]), base.split('.')[0].replace('-', ' ').title()) 
    # Fallback for topic numbers if present, otherwise, pretty print filename
    # This needs to be robust based on actual filenames in data/1101
    # For now, let's assume a simple mapping or direct use of TOPIC_MAP for new_questions

def main():
    """Main function to read JSON from multiple files, analyze questions, and write a report."""
    input_files = [
        '../new_questions_220-1101_3.json',
        '../data/1101/hardware.json',
        '../data/1101/mobile-devices.json',
        '../data/1101/networking.json',
        '../data/1101/troubleshooting.json',
        '../data/1101/virtualization-cloud.json',
        '../data/1101/miscellaneous.json' # Assuming this might exist or be created
    ]
    output_file = '../categorization_review_GLOBAL.md' # New report name for global review
    
    all_questions_data = [] # To store tuples of (question_obj, original_filename)
    processed_questions_for_dedup = set() # For deduplication: stores (question_text, frozenset(options))

    for file_path in input_files:
        if not os.path.exists(file_path):
            print(f"Warning: Input file not found at '{file_path}', skipping.")
            continue
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                questions_in_file = json.load(f)
                for q_idx, q_obj in enumerate(questions_in_file):
                    # Ensure question object is a dictionary
                    if not isinstance(q_obj, dict):
                        print(f"Warning: Skipping non-dictionary item at index {q_idx} in {file_path}")
                        continue
                    all_questions_data.append((q_obj, file_path))
        except json.JSONDecodeError:
            print(f"Error: Could not decode JSON from '{file_path}'. Skipping this file.")
            continue
        except Exception as e:
            print(f"An unexpected error occurred while processing '{file_path}': {e}. Skipping this file.")
            continue

    report_sections = {
        'correct': [],
        'needs_review': [],
        'uncategorized': [],
        'duplicates': []
    }

    # Sort all_questions_data by original file path to group them somewhat in the report
    all_questions_data.sort(key=lambda x: x[1])

    for i, (q_data, original_file) in enumerate(all_questions_data):
        question_text = q_data.get('question', '').strip()
        options = tuple(sorted(q_data.get('options', [])))
        question_signature = (question_text, frozenset(options))

        # Deduplication check
        is_duplicate = False
        if question_signature in processed_questions_for_dedup:
            is_duplicate = True
        else:
            processed_questions_for_dedup.add(question_signature)

        # Determine original topic
        # For new_questions_220-1101_3.json, use the 'topic' field
        # For existing files (e.g., hardware.json), the filename itself is the topic
        original_topic_name = ''
        if 'new_questions' in original_file:
            original_topic_num = q_data.get('topic') # Numeric topic from new_questions
            original_topic_name = TOPIC_MAP.get(original_topic_num, 'Unknown in new_questions')
        else:
            # Derive from filename for existing topic files
            filename_base = os.path.basename(original_file).split('.')[0]
            # Simple mapping for now, can be made more robust
            if filename_base == 'hardware': original_topic_name = 'Hardware'
            elif filename_base == 'mobile-devices': original_topic_name = 'Mobile Devices'
            elif filename_base == 'networking': original_topic_name = 'Networking'
            elif filename_base == 'troubleshooting': original_topic_name = 'Hardware & Network Troubleshooting'
            elif filename_base == 'virtualization-cloud': original_topic_name = 'Virtualization & Cloud'
            elif filename_base == 'miscellaneous': original_topic_name = 'Miscellaneous'
            else: original_topic_name = f"Unknown (from {filename_base})"
        
        suggested_topic, matched_keywords = analyze_question_topic(q_data)

        question_summary_header = (
            f"### Question ID (Original File: `{os.path.basename(original_file)}` - Index: {all_questions_data.index((q_data, original_file))})\n"
        )
        question_details = (
            f"**Question:** {question_text}\n"
            f"**Original Topic:** `{original_topic_name}`\n"
        )
        full_summary = question_summary_header + question_details

        if is_duplicate:
            duplicate_info = f"**DUPLICATE DETECTED:** This question appears to be a duplicate.\n"
            report_sections['duplicates'].append(full_summary + duplicate_info)
            # Skip further categorization for duplicates, or decide how to handle
            # For now, we'll still categorize it but flag it.

        if suggested_topic == 'Uncategorized':
            report_sections['uncategorized'].append(full_summary)
        elif original_topic_name == suggested_topic and not is_duplicate: # Don't put duplicates in 'correct'
            report_sections['correct'].append(full_summary)
        elif not is_duplicate: # Don't put duplicates in 'needs_review' either if already in duplicate section
            review_details = (
                f"**Suggested Topic:** `{suggested_topic}`\n"
                f"**Reason (Keywords Found):** `{', '.join(matched_keywords)}`\n"
            )
            report_sections['needs_review'].append(full_summary + review_details)

    # Write the report
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("# Global Question Topic Categorization Review\n\n")
        f.write("This report analyzes questions from ALL JSON files and suggests topics based on keywords. Duplicates are also flagged.\n\n")
        
        f.write("## Duplicates Detected\n")
        f.write("These questions appear to be duplicates of others found in the dataset. Review and decide on removal.\n\n")
        f.write('\n---\n'.join(report_sections['duplicates']) or "_None_\n")
        f.write("\n\n")

        f.write("## Needs Review (Potential Re-categorization)\n")
        f.write("These questions may be in the wrong category or could be moved to a more specific one (e.g., Troubleshooting). Please review.\n\n")
        f.write('\n---\n'.join(report_sections['needs_review']) or "_None_\n")
        f.write("\n\n")

        f.write("## Likely Correct\n")
        f.write("These questions appear to be categorized correctly and are not flagged as duplicates.\n\n")
        f.write('\n---\n'.join(report_sections['correct']) or "_None_\n")
        f.write("\n\n")

        f.write("## Uncategorized\n")
        f.write("Could not determine a clear topic for these questions (and not flagged as duplicate).\n\n")
        f.write('\n---\n'.join(report_sections['uncategorized']) or "_None_\n")

    print(f"Analysis complete. Report written to '{output_file}'")

if __name__ == '__main__':
    main()
