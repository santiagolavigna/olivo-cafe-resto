"""Pre-render menu PDFs to JPG pages for the carta viewer."""
import json
from pathlib import Path

import fitz

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "carta" / "pages"
MENUS = {
    "cafeteria": ROOT / "assets" / "menu-cafeteria.pdf",
    "restaurante": ROOT / "assets" / "menu-restaurante.pdf",
}
# Sharp enough for phone zoom / desktop retina
ZOOM = 2.8


def export_menu(key: str, pdf_path: Path) -> list[dict]:
    doc = fitz.open(pdf_path)
    dest = OUT / key
    dest.mkdir(parents=True, exist_ok=True)
    for old in dest.glob("*.jpg"):
        old.unlink()

    pages: list[dict] = []
    mat = fitz.Matrix(ZOOM, ZOOM)

    for i, page in enumerate(doc, start=1):
        rect = page.rect
        landscape = rect.width > rect.height * 1.05
        pix = page.get_pixmap(matrix=mat, alpha=False)
        name = f"{i:02d}.jpg"
        out = dest / name
        pix.pil_save(out.as_posix(), format="JPEG", quality=88, optimize=True)
        pages.append(
            {
                "src": f"./pages/{key}/{name}",
                "w": pix.width,
                "h": pix.height,
                "orientation": "landscape" if landscape else "portrait",
            }
        )
        print(" ", out.relative_to(ROOT), pix.width, "x", pix.height, pages[-1]["orientation"])

    print(f"{key}: {len(pages)} pages from {doc.page_count} pdf pages")
    return pages


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for key, path in MENUS.items():
        print("rendering", key)
        manifest[key] = export_menu(key, path)
    (OUT / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print("wrote", OUT / "manifest.json")


if __name__ == "__main__":
    main()
