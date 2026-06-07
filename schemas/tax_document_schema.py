from typing import Optional
from typing import Dict
from typing import Any

from pydantic import BaseModel


class TaxDocumentSchema(BaseModel):

    # Document Identification

    document_type: Optional[str] = None

    tax_year: Optional[str] = None

    filing_entity: Optional[str] = None

    ein: Optional[str] = None

    # Taxpayer

    taxpayer: Dict[str, Any] = {}

    # Partnership

    partnership: Dict[str, Any] = {}

    # Financial Data

    financial: Dict[str, Any] = {}

    # State Data

    state_information: Dict[str, Any] = {}

    # Foreign Data

    foreign_information: Dict[str, Any] = {}

    # Dynamic Box Values

    financial_boxes: Dict[str, Any] = {}

    # Unknown Fields

    form_specific_fields: Dict[str, Any] = {}

    # AI Metadata

    confidence_score: Optional[float] = None