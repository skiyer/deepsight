#!/usr/bin/env python3
import sys
from pathlib import Path


def main() -> int:
    if len(sys.argv) < 3:
        print("Usage: markitdown_convert.py <input> <output>", file=sys.stderr)
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    try:
        from markitdown import MarkItDown
    except Exception as exc:  # pragma: no cover
        print(f"Failed to import markitdown: {exc}", file=sys.stderr)
        return 2

    try:
        md = MarkItDown()
        result = md.convert(str(input_path))
        text = getattr(result, "text_content", None)
        if text is None:
            text = str(result)

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(text or "", encoding="utf-8")
        return 0
    except Exception as exc:  # pragma: no cover
        print(f"markitdown conversion failed: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    sys.exit(main())
