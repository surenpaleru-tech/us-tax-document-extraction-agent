"""
PDF Service

Purpose
-------
1. Detect whether PDF is digital or scanned.
2. Extract text from digital PDFs.
3. Convert scanned PDFs into images.
4. Prepare images for Vision LLM processing.

Architecture
------------

Digital PDF
    ↓
pdfplumber
    ↓
Text

Scanned PDF
    ↓
PyMuPDF
    ↓
PNG Images
    ↓
Vision LLM

Author:
Tax Document Intelligence Platform
"""

from pathlib import Path
import fitz
import pdfplumber
from PIL import Image


class PDFService:

    # Minimum amount of text required
    # to classify PDF as digital.
    DIGITAL_THRESHOLD = 100

    @staticmethod
    def is_digital_pdf(
        pdf_path: str
    ) -> bool:
        """
        Determine whether PDF contains
        embedded text.

        Returns
        -------
        True  -> Digital PDF
        False -> Scanned PDF
        """

        try:

            text = ""

            with pdfplumber.open(
                pdf_path
            ) as pdf:

                pages_to_check = min(
                    1,
                    len(pdf.pages)
                )

                for page in pdf.pages[
                    :pages_to_check
                ]:

                    page_text = (
                        page.extract_text()
                    )

                    if page_text:

                        text += page_text

            return (
                len(text.strip())
                > PDFService.DIGITAL_THRESHOLD
            )

        except Exception as ex:

            print(
                f"Digital PDF detection failed: {ex}"
            )

            return False

    @staticmethod
    def extract_text(
        pdf_path: str
    ) -> str:
        """
        Extract text from digital PDFs.

        Uses pdfplumber because it
        generally performs better
        for tax documents.
        """

        extracted_text = []

        try:

            with pdfplumber.open(
                pdf_path
            ) as pdf:

                for page in pdf.pages:

                    page_text = (
                        page.extract_text()
                    )

                    if page_text:

                        extracted_text.append(
                            page_text
                        )

        except Exception as ex:

            raise Exception(
                f"PDF extraction failed: {ex}"
            )

        return "\n".join(
            extracted_text
        )

    @staticmethod
    def convert_to_images(
        pdf_path: str,
        output_folder: str = "output/pages"
    ) -> list[str]:
        """
        Convert PDF pages to compact JPEG images.

        Used only for scanned PDFs.

        Returns
        -------
        List of image file paths.
        """

        output_dir = (
            Path(output_folder)
            /
            Path(pdf_path).stem
        )

        output_dir.mkdir(
            parents=True,
            exist_ok=True
        )

        image_paths = []

        pdf_document = fitz.open(
            pdf_path
        )

        for page_number in range(
            len(pdf_document)
        ):

            page = pdf_document[
                page_number
            ]

            # Keep local vision payloads compact enough for Ollama.
            matrix = fitz.Matrix(
                2,
                2
            )

            pix = page.get_pixmap(
                matrix=matrix,
                alpha=False,
            )

            image_path = (
                output_dir
                / f"page_{page_number+1}.jpg"
            )

            image = Image.frombytes(
                "RGB",
                [pix.width, pix.height],
                pix.samples
            )

            image.thumbnail(
                (1600, 2200)
            )

            image.save(
                str(image_path),
                format="JPEG",
                quality=82,
                optimize=True
            )

            image_paths.append(
                str(image_path)
            )

        pdf_document.close()

        return image_paths

    @classmethod
    def load_document(
        cls,
        pdf_path: str
    ) -> dict:
        """
        Main document loading method.

        Returns

        Digital PDF:

        {
            "document_mode": "digital",
            "text": "..."
        }

        Scanned PDF:

        {
            "document_mode": "scanned",
            "images": [...]
        }
        """

        if not Path(
            pdf_path
        ).exists():

            raise FileNotFoundError(
                f"PDF not found: {pdf_path}"
            )

        is_digital = (
            cls.is_digital_pdf(
                pdf_path
            )
        )

        if is_digital:

            return {
                "document_mode":
                    "digital",

                "text":
                    cls.extract_text(
                        pdf_path
                    )
            }

        return {
            "document_mode":
                "scanned",

            "images":
                cls.convert_to_images(
                    pdf_path
                )
        }
