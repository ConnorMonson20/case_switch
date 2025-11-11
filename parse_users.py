import csv

INPUT_FILE = "users_raw.txt"
OUTPUT_FILE = "users_parsed.csv"

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    text = f.read()

tokens = text.split()
rows = []
i = 0
n = len(tokens)

def clean(val: str) -> str:
    return val.strip()

def is_user_id(tok: str) -> bool:
    return tok.isdigit()

while i < n:
    tok = tokens[i]

    if is_user_id(tok):
        user_id = tok

        if i + 4 >= n:
            break

        first = tokens[i + 1]
        last = tokens[i + 2]
        phone = tokens[i + 3]
        email = tokens[i + 4]
        i += 5

        flags_parts = []
        while i < n:
            if is_user_id(tokens[i]) and i + 4 < n:
                break
            flags_parts.append(tokens[i])
            i += 1

        flags = " ".join(flags_parts).strip()
        # Replace commas with semicolons so csv won't quote it
        flags = flags.replace(",", ";")

        rows.append([
            user_id,
            clean(first),
            clean(last),
            clean(phone),
            clean(email),
            flags
        ])
    else:
        i += 1

with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(["user_ID", "First Name", "Last Name", "Phone Number", "Email", "Flags"])
    writer.writerows(rows)

print(f"Tokens: {len(tokens)}")
print(f"Rows written: {len(rows)}")
print(f"Output: {OUTPUT_FILE}")
