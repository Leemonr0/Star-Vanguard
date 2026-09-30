import re

def verify():
    with open('game.js', 'r', encoding='utf-8') as f:
        js = f.read()

    with open('index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    # Check DOM IDs referenced in JS
    js_ids = set(re.findall(r"getElementById\(['\"]([a-zA-Z0-9_\-]+)['\"]\)", js))
    html_ids = set(re.findall(r"id=['\"]([a-zA-Z0-9_\-]+)['\"]", html))

    print(f"Total IDs referenced in JS: {len(js_ids)}")
    print(f"Total IDs in HTML: {len(html_ids)}")

    missing_in_html = js_ids - html_ids
    print(f"IDs in JS missing in HTML: {missing_in_html}")

    # Check curly brackets in JS
    curly = 0
    in_str = None
    escape = False
    in_line_comment = False
    in_block_comment = False

    i = 0
    while i < len(js):
        ch = js[i]
        nxt = js[i+1] if i + 1 < len(js) else ''

        if in_line_comment:
            if ch == '\n':
                in_line_comment = False
        elif in_block_comment:
            if ch == '*' and nxt == '/':
                in_block_comment = False
                i += 1
        elif in_str:
            if escape:
                escape = False
            elif ch == '\\':
                escape = True
            elif ch == in_str:
                in_str = None
        else:
            if ch == '/' and nxt == '/':
                in_line_comment = True
                i += 1
            elif ch == '/' and nxt == '*':
                in_block_comment = True
                i += 1
            elif ch in ('"', "'", '`'):
                in_str = ch
            elif ch == '{':
                curly += 1
            elif ch == '}':
                curly -= 1

        i += 1

    print(f"Brace balance curly: {curly}")
    if curly == 0 and len(missing_in_html) == 0:
        print("ALL CHECKS PASSED PERFECTLY!")
    else:
        print("WARNING: Some checks failed!")

if __name__ == '__main__':
    verify()
