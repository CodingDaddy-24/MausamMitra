from math import isfinite

PROVIDERS = ("gfs", "ifs", "aifs", "gfs_ensemble")
VARIABLES = ("rainfall", "temperature", "wind")


def inverse_error_weights(metrics: dict[str, dict] | None, providers: tuple[str, ...] = PROVIDERS) -> tuple[dict[str, float], str]:
    """Compute inverse skill weights from 70% MAE and 30% RMSE; equal-weight only when skill is missing."""
    valid: dict[str, float] = {}
    for provider in providers:
        row = (metrics or {}).get(provider)
        if not row:
            continue
        try:
            mae, rmse = float(row["mae"]), float(row["rmse"])
        except (KeyError, TypeError, ValueError):
            continue
        score = 0.7 * mae + 0.3 * rmse
        if isfinite(score) and score > 0:
            valid[provider] = score
    if len(valid) < 2:
        return {name: 1 / len(providers) for name in providers}, "Equal-weight fallback: fewer than two valid verified model scores."
    inverse = {name: 1 / score for name, score in valid.items()}
    total = sum(inverse.values())
    return {name: value / total for name, value in inverse.items()}, "Inverse error: 70% MAE + 30% RMSE, normalized per variable."
