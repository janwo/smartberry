import re


def enum(**enums):
    return type('Enum', (), enums)


def get_room_name(item_name):
    match = re.search(r"^([^_]+_[^_]+).*$", item_name)
    if match is None:
        return None
    return match.group(1)
