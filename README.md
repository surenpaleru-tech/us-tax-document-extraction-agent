# Tax Document Intelligence Platform

## Overview

Tax Document Intelligence Platform is an enterprise-grade, AI-powered solution designed to automate the extraction, validation, review, and persistence of information from tax documents.

The platform supports both digital and scanned tax documents and provides a generic architecture that allows organizations to switch between Large Language Models (LLMs) such as Ollama, Google Gemini, and future providers like OpenAI without changing application code.

---

## Key Features

### Universal Tax Extraction

* Supports multiple tax document types.
* Automatically detects and extracts relevant tax information.
* No hardcoded logic for specific forms (K-1, 1040, W-2, 1099, etc.).
* Dynamic extraction using configurable prompts and schemas.

### Multi-Provider LLM Architecture

Provider selection is completely configuration-driven.

Supported providers:

* Ollama
* Google Gemini
* OpenAI (future-ready)
* Any LangChain-supported provider

Example:

```yaml
text:
  provider: ollama
  model: qwen3.5:4b

vision:
  provider: google_genai
  model: gemini-2.5-flash
```

Switch providers by updating YAML files only.

No Python code changes required.

---

## Supported Document Types

### Digital PDFs

* Text extraction using PyMuPDF
* Chunk-based processing
* Multi-page support

### Scanned PDFs

* Google Gemini Direct PDF extraction
* Image rendering fallback
* Vision-based extraction

### Image Formats

* PNG
* JPG
* JPEG

---

## Enterprise Architecture

```text
Users
 ↓
Upload PDFs / ZIPs
 ↓
Batch Processor
 ↓
LangGraph Workflow
 ↓
PDF Service
 ↓
Digital? ───── Yes ──→ Text Extraction
     │
     No
     │
Gemini Direct PDF
or Vision Image Path
 ↓
LLM Service (init_chat_model)
 ↓
Gemini / Ollama / OpenAI
 ↓
Tax Document Extraction Agent
 ↓
JSON Repair
 ↓
Validation
 ↓
Confidence Scoring
 ↓
Excel / JSON Export
 ↓
SQLite
 ↓
Review Queue
 ↓
Audit Logs
 ↓
Batch Reports
```

---

## Project Structure

```text
tax-document-intelligence/

├── agents/
├── batch/
├── config/
├── input/
├── logs/
├── output/
│   ├── excel/
│   ├── json/
│   ├── reports/
│   └── review/
├── services/
├── workflows/
├── data/
├── tests/
├── main.py
└── requirements.txt
```

---

## Technologies Used

### Core

* Python 3.14
* LangChain
* LangGraph
* SQLite
* PyMuPDF
* Pandas
* PyYAML

### LLM Providers

* Ollama
* Google Gemini
* OpenAI (future-ready)

---

## Installation

### Clone Repository

```bash
git clone https://github.com/<your-username>/tax-document-intelligence.git

cd tax-document-intelligence
```

### Create Virtual Environment

```bash
python -m venv .venv
```

Activate:

Windows:

```bash
.venv\Scripts\activate
```

Linux/Mac:

```bash
source .venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

---

## Environment Variables

Google Gemini:

```bash
GOOGLE_API_KEY=your_key
```

OpenAI:

```bash
OPENAI_API_KEY=your_key
```

---

## Configuration

### models.yaml

Example:

```yaml
text:
  provider: ollama
  model: qwen3.5:4b

vision:
  provider: google_genai
  model: gemini-2.5-flash
```

---

## Running Single Document Processing

Place PDF into:

```text
input/
```

Run:

```bash
python main.py
```

Outputs:

```text
output/json/
output/excel/
output/review/
```

---

## Batch Processing

Process entire folders of PDFs.

Example:

```text
input/
├── tax_doc_1.pdf
├── tax_doc_2.pdf
├── tax_doc_3.pdf
```

Run batch processor:

```python
processor.process_folder("input")
```

Outputs:

* JSON files
* Excel files
* SQLite records
* Review items
* Batch reports

---

## Validation and Review

Validation includes:

* Required field checks
* Missing value detection
* Nested field validation

Confidence scoring determines whether documents require human review.

Example:

```text
Confidence ≥ 85
    ↓
Automatically Approved

Confidence < 85
    ↓
Human Review Queue
```

---

## Persistence

SQLite is used by default.

Stored information includes:

* Extracted document data
* Confidence scores
* Validation errors
* Review flags
* Batch processing statistics

The architecture is designed to support PostgreSQL migration in future releases.

---

## Future Enhancements

Planned enhancements include:

* FastAPI APIs
* Streamlit Dashboard
* Authentication and RBAC
* PostgreSQL Support
* Vector Search
* RAG Chat Interface
* Docker Deployment
* Kubernetes Support
* CI/CD Pipelines
* Automated Testing Framework

---

## Contributing

Contributions are welcome.

Please:

1. Fork the repository.
2. Create a feature branch.
3. Commit your changes.
4. Submit a Pull Request.

---

## Disclaimer

This project is intended to assist with tax document processing and review workflows.

Extracted results should always be validated by qualified professionals before being used for tax filing, compliance, or regulatory submissions.

---

## License

MIT License

Copyright (c) 2026

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files to deal in the Software without restriction.
