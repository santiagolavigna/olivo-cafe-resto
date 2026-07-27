import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "carta" / "pages"
MENUS = {
    "cafeteria": ROOT / "assets" / "menu-cafeteria.pdf",
    "restaurante": ROOT / "assets" / "menu-restaurante.pdf",
}
ZOOM = 2.4


def export_menu(key: str, pdf_path: Path) -> list[str]:
    doc = fitz.open(pdf_path)
    dest = OUT / key
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.jpg"):
        old.unlink()

    files: list[str] = []
    idx = 1
    mat = fitz.Matrix(ZOOM, ZOOM)

    for page in doc:
        rect = page.rect
        landscape = rect.width > rect.height * 1.05
        clips = []
        if landscape:
            mid = rect.x0 + rect.width / 2
            clips.append(fitz.Rect(rect.x0, rect.y0, mid, rect.y1))
            clips.append(fitz.Rect(mid, rect.y0, rect.x1, rect.y1))
        else:
            clips.append(rect)

        for clip in clips:
            pix = page.get_pixmap(matrix=mat, clip=clip, alpha=False)
            name = f"{idx:02d}.jpg"
            out = dest / name
            pix.pil_save(out.as_posix(), format="JPEG", quality=84, optimize=True)
            files.append(f"./pages/{key}/{name}")
            idx += 1
            print(" ", out.relative_to(ROOT), pix.width, "x", pix.height)

    print(f"{key}: {len(files)} slides from {doc.page_count} pdf pages")
    return files


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, path in MENUS.items():
        print("rendering", key)
        manifest[key] = export_menu(key, path)
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print("wrote", OUT / "manifest.json")


if __name__ == "__main__":
    main()
