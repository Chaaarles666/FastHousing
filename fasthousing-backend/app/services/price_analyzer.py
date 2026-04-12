def build_price_verdict(input_unit_price: float, history_prices: list[float]) -> dict[str, float | str]:
    if not history_prices:
        return {"percentile": 0.0, "verdict": "数据不足"}

    sorted_prices = sorted(history_prices)
    below_count = len([price for price in sorted_prices if price <= input_unit_price])
    percentile = round((below_count / len(sorted_prices)) * 100, 2)

    if percentile <= 20:
        verdict = "偏低"
    elif percentile <= 65:
        verdict = "合理"
    elif percentile <= 85:
        verdict = "偏高"
    else:
        verdict = "明显偏高"

    return {"percentile": percentile, "verdict": verdict}
