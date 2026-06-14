import json


class JsonParser:

    @staticmethod
    def parse(
        llm_response
    ):

        try:

            start = (
                llm_response
                .find("{")
            )

            end = (
                llm_response
                .rfind("}")
            )

            cleaned = (
                llm_response[
                    start:end+1
                ]
            )

            return json.loads(
                cleaned
            )

        except Exception:

            return {}