from __future__ import annotations

import io
import logging


logger = logging.getLogger(__name__)


def extract_searchable_text(file_content: bytes, content_type: str | None, filename: str | None = None) -> str:
    mime_type = (content_type or "").lower()
    normalized_name = (filename or "").lower()

    if mime_type.startswith("text/") or normalized_name.endswith((".txt", ".md", ".csv", ".json")):
        return _trim_text(file_content.decode("utf-8", errors="ignore"))

    if "pdf" in mime_type or normalized_name.endswith(".pdf"):
        try:
            import fitz  # type: ignore

            with fitz.open(stream=file_content, filetype="pdf") as document:
                text = "\n".join(page.get_text("text") for page in document)
                if _has_meaningful_text(text):
                    return _trim_text(text)
                logger.info("PDF %s appears scanned; using OCR fallback", filename)
                return _trim_text(_ocr_pdf_document(document))
        except Exception as exc:
            logger.warning("Failed to extract PDF text for %s: %s", filename, exc)

    if mime_type.startswith("image/") or normalized_name.endswith((".png", ".jpg", ".jpeg", ".webp", ".tif", ".tiff", ".bmp")):
        try:
            return _trim_text(_ocr_image_bytes(file_content))
        except Exception as exc:
            logger.warning("Failed to OCR image %s: %s", filename, exc)

    return ""


def _trim_text(text: str, limit: int = 200_000) -> str:
    return text[:limit].strip()


def _has_meaningful_text(text: str, min_chars: int = 40) -> bool:
    return len("".join(text.split())) >= min_chars


def _ocr_pdf_document(document) -> str:
    text_chunks: list[str] = []
    for page in document:
        pixmap = page.get_pixmap(matrix=(2, 2), alpha=False)
        text_chunks.append(_ocr_image_bytes(pixmap.tobytes("png")))
    return "\n".join(chunk for chunk in text_chunks if chunk)


def _ocr_image_bytes(image_bytes: bytes) -> str:
    try:
        from PIL import Image
        import pytesseract
    except ImportError as exc:  # pragma: no cover - depends on runtime image
        raise RuntimeError("OCR dependencies are not installed") from exc

    with Image.open(io.BytesIO(image_bytes)) as image:
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")
        return pytesseract.image_to_string(image)
