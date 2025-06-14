import os
import json
import re
from collections import defaultdict

data_dir = os.path.join('data', '1101')
topic_files = [
    'hardware.json',
    'networking.json',
    'mobile-devices.json',
    'troubleshooting.json',
    'virtualization-cloud.json',
    'miscellaneous.json'
]

NEW_QUESTION_RE = re.compile(r'^NEW QUESTION \d+\s*', re.IGNORECASE)

def qkey(q):
    # Deduplication key: question (stripped, casefolded), sorted options
    return (
        NEW_QUESTION_RE.sub('', q['question']).strip().casefold(),
        tuple(sorted([o.strip().casefold() for o in q['options']]))
    )

def audit_and_cleanup():
    for fname in topic_files:
        fpath = os.path.join(data_dir, fname)
        if not os.path.exists(fpath):
            continue
        with open(fpath, 'r', encoding='utf-8') as f:
            try:
                questions = json.load(f)
            except Exception as e:
                print(f"[ERROR] Could not read {fname}: {e}")
                continue
        seen = set()
        cleaned = []
        newq_count = 0
        dupe_count = 0
        for q in questions:
            orig_qtext = q['question']
            # Remove NEW QUESTION n prefix
            q['question'] = NEW_QUESTION_RE.sub('', q['question']).strip()
            if orig_qtext != q['question']:
                newq_count += 1
            # Deduplication
            key = qkey(q)
            if key in seen:
                dupe_count += 1
                continue
            seen.add(key)
            cleaned.append(q)
        # Reassign sequential IDs
        for i, q in enumerate(cleaned, 1):
            q['id'] = i
        # Write back if any changes
        if newq_count > 0 or dupe_count > 0 or len(cleaned) != len(questions):
            with open(fpath, 'w', encoding='utf-8') as f:
                json.dump(cleaned, f, indent=2, ensure_ascii=False)
        print(f"{fname}: {newq_count} questions fixed, {dupe_count} duplicates removed, {len(questions)-len(cleaned)} dropped, {len(cleaned)} total.")

def main():
    audit_and_cleanup()

if __name__ == '__main__':
    main()
