"""
Configuration Loader

Loads all YAML-based configurations.

Benefits:

- No hardcoded prompts
- No hardcoded schemas
- No hardcoded models
"""

from pathlib import Path
import yaml


class ConfigLoader:

    @staticmethod
    def load_yaml(file_path: str):

        with open(
            file_path,
            "r",
            encoding="utf-8"
        ) as file:

            return yaml.safe_load(file)

    @staticmethod
    def get_config(file_name: str):

        config_path = (
            Path("config")
            / file_name
        )

        return ConfigLoader.load_yaml(
            config_path
        )