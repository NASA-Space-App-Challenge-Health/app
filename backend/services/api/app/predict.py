"""Small, explicit forecasts. No new clinical cutoffs.

Lab lines use the observed days from launch. Day 30, 90, and 180 are reported
on that line and marked as inside or beyond the observed span. The only
extrapolation is one median gap past the last draw. Prediction intervals use
the Student-t multiplier for n-2 degrees of freedom. With at most seven
Inspiration4 points those intervals are wide on purpose.
"""

from __future__ import annotations

import math
from statistics import median
from typing import Any

# Two-sided 95% Student-t critical values, df = n - 2.
_T95 = {
    1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571,
    6: 2.447, 7: 2.365, 8: 2.306, 9: 2.262, 10: 2.228,
    15: 2.131, 20: 2.086, 30: 2.042,
}

HORIZON_DAYS = (30, 90, 180)


def _t95(df: int) -> float:
    if df in _T95:
        return _T95[df]
    if df <= 0:
        return _T95[1]
    return 1.96


def _phi(z: float) -> float:
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


def ols_fit(xs: list[float], ys: list[float]) -> dict[str, float]:
    n = len(xs)
    xbar = sum(xs) / n
    ybar = sum(ys) / n
    sxx = sum((x - xbar) ** 2 for x in xs)
    sxy = sum((x - xbar) * (y - ybar) for x, y in zip(xs, ys))
    slope = sxy / sxx if sxx else 0.0
    intercept = ybar - slope * xbar
    resid = [y - (intercept + slope * x) for x, y in zip(xs, ys)]
    df = n - 2
    sigma2 = sum(r * r for r in resid) / df if df > 0 else 0.0
    return {
        "n": n,
        "intercept": intercept,
        "slope_per_day": slope,
        "sigma2": sigma2,
        "xbar": xbar,
        "sxx": sxx,
        "df": df,
    }


def theil_sen(xs: list[float], ys: list[float]) -> dict[str, float]:
    slopes = []
    for i in range(len(xs)):
        for j in range(i + 1, len(xs)):
            dx = xs[j] - xs[i]
            if dx != 0:
                slopes.append((ys[j] - ys[i]) / dx)
    slope = median(slopes) if slopes else 0.0
    intercept = median(y - slope * x for x, y in zip(xs, ys))
    return {"method": "theil_sen", "slope_per_day": slope, "intercept": intercept}


def predict_at(fit: dict[str, float], day: float) -> dict[str, float]:
    yhat = fit["intercept"] + fit["slope_per_day"] * day
    sxx = fit["sxx"] or 0.0
    scale = 1.0 + 1.0 / fit["n"]
    if sxx:
        scale += (day - fit["xbar"]) ** 2 / sxx
    se = math.sqrt(max(fit["sigma2"], 0.0) * scale)
    half = _t95(int(fit["df"])) * se
    return {"yhat": yhat, "pi95_low": yhat - half, "pi95_high": yhat + half, "se": se}


def p_out_of_range(yhat: float, se: float, low: float | None, high: float | None) -> float | None:
    """Rough probability under a normal prediction interval. Not a clinical risk model."""
    if se <= 0 or low is None or high is None or high <= low:
        return None
    return _phi((low - yhat) / se) + (1.0 - _phi((high - yhat) / se))


def z_vs_range(value: float, low: float | None, high: float | None) -> float | None:
    if low is None or high is None or high <= low:
        return None
    mid = (low + high) / 2.0
    sd = (high - low) / 4.0
    if sd == 0:
        return None
    return (value - mid) / sd


def lab_forecast(points: list[dict[str, Any]]) -> dict[str, Any] | None:
    """points: day, value, timepoint, ref_low, ref_high, flag."""
    usable = [p for p in points if p.get("value") is not None and p.get("day") is not None]
    usable.sort(key=lambda p: p["day"])
    if len(usable) < 3:
        return None
    xs = [float(p["day"]) for p in usable]
    ys = [float(p["value"]) for p in usable]
    fit = ols_fit(xs, ys)
    robust = theil_sen(xs, ys)
    pre = [p for p in usable if p["day"] < 0]
    baseline = sum(float(p["value"]) for p in pre) / len(pre) if pre else None
    last = usable[-1]
    ref_low = last.get("ref_low")
    ref_high = last.get("ref_high")
    gaps = [xs[i] - xs[i - 1] for i in range(1, len(xs)) if xs[i] != xs[i - 1]]
    step = median(gaps) if gaps else 1.0
    next_day = xs[-1] + step
    targets = [("next_step", next_day, False)]
    span_min, span_max = xs[0], xs[-1]
    for day in HORIZON_DAYS:
        targets.append((f"day_{day}", float(day), span_min <= day <= span_max))
    forecasts = []
    for label, day, inside in targets:
        pred = predict_at(fit, day)
        forecasts.append({
            "label": label,
            "day": day,
            "inside_observed_span": inside,
            "assumption": (
                "Point on the line fitted to the observed Inspiration4 days. Not a forecast beyond the data."
                if inside
                else "Extrapolated with the same straight line past the last observed day. The line is not a physiological model."
            ),
            "yhat": round(pred["yhat"], 4),
            "pi95_low": round(pred["pi95_low"], 4),
            "pi95_high": round(pred["pi95_high"], 4),
            "p_out_of_range": None if p_out_of_range(pred["yhat"], pred["se"], ref_low, ref_high) is None
            else round(p_out_of_range(pred["yhat"], pred["se"], ref_low, ref_high), 4),
        })
    last_z = z_vs_range(float(last["value"]), ref_low, ref_high)
    outside = last.get("flag") in {"low", "high"}
    slope = fit["slope_per_day"]
    worsening_pairs = []
    for earlier, later in zip(usable, usable[1:]):
        side = earlier.get("flag")
        if side not in {"low", "high"} or later.get("flag") != side:
            continue
        if side == "low" and float(later["value"]) < float(earlier["value"]):
            worsening_pairs.append((earlier, later))
        if side == "high" and float(later["value"]) > float(earlier["value"]):
            worsening_pairs.append((earlier, later))
    next_fc = forecasts[0]
    trending = False
    if not outside and ref_low is not None and ref_high is not None:
        trending = next_fc["yhat"] < ref_low or next_fc["yhat"] > ref_high
    flags = []
    if worsening_pairs:
        flags.append("already_out_and_worsening")
    if trending:
        flags.append("trending_toward_out_of_range")
    return {
        "n": len(usable),
        "history": {
            "x": xs,
            "y": ys,
            "timepoints": [p.get("timepoint") for p in usable],
        },
        "fit": {
            "method": "ols",
            "slope_per_day": round(slope, 6),
            "intercept": round(fit["intercept"], 4),
        },
        "robust": {
            "method": "theil_sen",
            "slope_per_day": round(robust["slope_per_day"], 6),
            "intercept": round(robust["intercept"], 4),
        },
        "baseline": {
            "preflight_mean": None if baseline is None else round(baseline, 4),
            "last_minus_baseline": None if baseline is None else round(float(last["value"]) - baseline, 4),
        },
        "last": {
            "day": xs[-1],
            "timepoint": last.get("timepoint"),
            "value": float(last["value"]),
            "flag": last.get("flag"),
            "z_score": None if last_z is None else round(last_z, 3),
            "ref_low": ref_low,
            "ref_high": ref_high,
            "unit": last.get("unit"),
        },
        "forecasts": forecasts,
        "forecast_x": [item["day"] for item in forecasts],
        "forecast_y": [item["yhat"] for item in forecasts],
        "pi95_low": [item["pi95_low"] for item in forecasts],
        "pi95_high": [item["pi95_high"] for item in forecasts],
        "flags": flags,
        "worsening_pairs": [
            {
                "earlier_timepoint": a.get("timepoint"),
                "earlier_value": float(a["value"]),
                "later_timepoint": b.get("timepoint"),
                "later_value": float(b["value"]),
                "flag": a.get("flag"),
            }
            for a, b in worsening_pairs
        ],
        "uncertainty": f"{len(usable)} observed points. The 95% band is a prediction interval, and it is wide because n is tiny.",
    }


def exponential_smoothing(values: list[float], alpha: float = 0.3) -> float:
    level = values[0]
    for value in values[1:]:
        level = alpha * value + (1.0 - alpha) * level
    return level


def radiation_forecast(
    hourly: list[dict[str, Any]],
    *,
    spike_at_least: float,
    horizon_hours: int = 24,
    alpha: float = 0.3,
) -> dict[str, Any]:
    """hourly items: hour (str or number index), instrument optional, rate."""
    if len(hourly) < 5:
        return {"series": [], "forecast": [], "spikes": [], "cumulative": []}
    # Pool instruments into one hourly mean if multiple rows share an hour label.
    by_hour: dict[str, list[float]] = {}
    for row in hourly:
        by_hour.setdefault(str(row["hour"]), []).append(float(row["rate"]))
    hours = sorted(by_hour)
    ys = [sum(by_hour[h]) / len(by_hour[h]) for h in hours]
    level = exponential_smoothing(ys, alpha)
    resid = [y - level for y in ys[-48:]] or [0.0]
    sigma = math.sqrt(sum(r * r for r in resid) / max(len(resid) - 1, 1))
    forecast = [{
        "hour_ahead": i,
        "yhat": round(level, 4),
        "pi95_low": round(level - 1.96 * sigma, 4),
        "pi95_high": round(level + 1.96 * sigma, 4),
    } for i in range(1, horizon_hours + 1)]
    spikes = [
        {"hour": hour, "rate": rate}
        for hour, rate in zip(hours, ys)
        if rate >= spike_at_least
    ]
    mean_rate = sum(ys) / len(ys)
    cumulative = []
    for days in HORIZON_DAYS:
        cumulative.append({
            "days": days,
            "mean_rate_ugy_h": round(mean_rate, 4),
            "area_dose_ugy": round(mean_rate * 24.0 * days, 1),
            "label": "Area dose from this week's mean absorbed dose rate, not a personal dose.",
            "assumption": "The June 2024 hourly mean repeats for the whole period. Spikes are not added on top.",
        })
    return {
        "method": "simple_exponential_smoothing",
        "alpha": alpha,
        "history": {"x": hours, "y": [round(y, 4) for y in ys]},
        "forecast": forecast,
        "forecast_x": [item["hour_ahead"] for item in forecast],
        "forecast_y": [item["yhat"] for item in forecast],
        "pi95_low": [item["pi95_low"] for item in forecast],
        "pi95_high": [item["pi95_high"] for item in forecast],
        "spikes_at_or_above_rule": spikes[-20:],
        "spike_threshold_ugy_h": spike_at_least,
        "spike_threshold_source": "rules.yaml emergency.radiation_with_sep.dose_rate_at_least",
        "cumulative": cumulative,
        "note": "SES will sit near the recent level and will miss the next South-Atlantic spike. The interval is residual scatter, not a physical model.",
    }


def simulated_vital_flags(points: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Anomaly against this simulated series only. Not a NASA limit."""
    if len(points) < 4:
        return None
    points = sorted(points, key=lambda p: p["recorded_at"])
    ys = [float(p["value"]) for p in points]
    mean = sum(ys) / len(ys)
    var = sum((y - mean) ** 2 for y in ys) / (len(ys) - 1)
    sd = math.sqrt(var)
    z = 0.0 if sd == 0 else (ys[-1] - mean) / sd
    return {
        "n": len(ys),
        "history": {"x": list(range(len(ys))), "y": ys},
        "mean": round(mean, 4),
        "sd": round(sd, 4),
        "last": ys[-1],
        "z_vs_own_series": round(z, 3),
        "anomaly": abs(z) >= 2.0,
        "anomaly_rule": "Last point is at least 2 sample standard deviations from this simulated series. Not a NASA threshold.",
        "origin": "simulated",
    }
