import os
from pathlib import Path

import pytest

try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None
    types = None


@pytest.mark.skipif(
    genai is None or types is None,
    reason="google-genai package is not installed"
)
@pytest.mark.skipif(
    os.getenv("GOOGLE_API_KEY") is None,
    reason="Google API key is required for Gemini integration test"
)
def test_google_gemini_image_extraction():
    api_key = os.getenv("GOOGLE_API_KEY")
    client = genai.Client(api_key=api_key)

    image_path = Path("output/pages/page_1.png")
    if not image_path.exists():
        pytest.skip("No sample output image available for vision test")

    with image_path.open("rb") as f:
        image_bytes = f.read()

    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=[
            "Analyze this tax document image and return ONLY valid JSON containing all extracted tax fields.",
            types.Part.from_bytes(
                data=image_bytes,
                mime_type="image/png"
            )
        ]
    )

    assert response is not None
    assert hasattr(response, "text")
    assert response.text.strip() != ""
