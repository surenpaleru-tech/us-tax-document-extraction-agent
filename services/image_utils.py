import base64


class ImageUtils:

    @staticmethod
    def image_to_base64(
        image_path
    ):

        with open(
            image_path,
            "rb"
        ) as file:

            return (
                base64
                .b64encode(
                    file.read()
                )
                .decode(
                    "utf-8"
                )
            )