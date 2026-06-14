
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

class DocumentBatchProcessor:

    @staticmethod
    def get_documents(folder_path, extensions=None, recursive=True):
        extensions = extensions or ["pdf"]
        files = []
        for ext in extensions:
            pattern = f"**/*.{ext}" if recursive else f"*.{ext}"
            files.extend(Path(folder_path).glob(pattern))
        return sorted(files)

    @staticmethod
    def process_batch(files, process_func, max_workers=4):
        results = []
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            for result in executor.map(process_func, files):
                results.append(result)
        return results
