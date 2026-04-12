from datetime import date
from typing import Any


def clean_price(price_str: str) -> float:
    value = price_str.replace("万", "").replace("元/㎡", "").strip()
    return float(value)


def clean_area(area_str: str) -> float:
    return float(area_str.replace("㎡", "").strip())


def clean_layout(layout_str: str) -> tuple[int, int, int]:
    rooms, halls, baths = 0, 0, 0
    if "室" in layout_str:
        rooms = int(layout_str.split("室")[0] or 0)
    if "厅" in layout_str:
        halls = int(layout_str.split("室")[-1].split("厅")[0] or 0)
    if "卫" in layout_str:
        baths = int(layout_str.split("厅")[-1].split("卫")[0] or 0)
    return rooms, halls, baths


def clean_date(date_str: str) -> date:
    value = date_str.replace("成交", "").replace(".", "-").strip()
    return date.fromisoformat(value)


def normalize_row(row: dict[str, Any]) -> dict[str, Any]:
    # TODO: extend with full transformation and validation rules.
    return row
