import sys
import json
import pdfplumber


def extract_text(pdf_path: str) -> str:
    texts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text() or ""
            texts.append(page_text)
    return "\n".join(texts)


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing argument: pdf_path"}))
        sys.exit(1)
    pdf_path = sys.argv[1]
    try:
        text = extract_text(pdf_path)
        print(json.dumps({"text": text}))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(2)


if __name__ == "__main__":
    main()


