from __future__ import annotations

import math
from datetime import datetime, timezone
from typing import Any

from .market_service import MarketService, MarketServiceError, OhlcvCandle


FEATURE_SOURCE = "python_feature_engine_v5"


def _number(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _round(value: float | None, digits: int = 6) -> float | None:
    return round(value, digits) if value is not None and math.isfinite(value) else None


def _percentage_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100


def _ema(values: list[float], period: int) -> float | None:
    if period <= 0 or len(values) < period:
        return None

    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    for value in values[period:]:
        ema = (value * multiplier) + (ema * (1 - multiplier))
    return ema


def _ema_series(values: list[float], period: int) -> list[float | None]:
    series: list[float | None] = [None] * len(values)
    if period <= 0 or len(values) < period:
        return series

    multiplier = 2 / (period + 1)
    ema = sum(values[:period]) / period
    series[period - 1] = ema

    for index in range(period, len(values)):
        ema = (values[index] * multiplier) + (ema * (1 - multiplier))
        series[index] = ema

    return series


def _macd(values: list[float]) -> tuple[float | None, float | None, float | None]:
    fast = _ema_series(values, 12)
    slow = _ema_series(values, 26)
    macd_values = [
        fast_value - slow_value
        for fast_value, slow_value in zip(fast, slow)
        if fast_value is not None and slow_value is not None
    ]

    if not macd_values:
        return None, None, None

    macd_line = macd_values[-1]
    signal = _ema(macd_values, 9)
    histogram = macd_line - signal if signal is not None else None
    return macd_line, signal, histogram


def _rsi(values: list[float], period: int = 14) -> float | None:
    if len(values) <= period:
        return None

    changes = [values[index] - values[index - 1] for index in range(1, len(values))]
    recent = changes[-period:]
    gains = [change for change in recent if change > 0]
    losses = [-change for change in recent if change < 0]
    average_gain = sum(gains) / period
    average_loss = sum(losses) / period

    if average_loss == 0:
        return 100.0 if average_gain > 0 else 50.0

    relative_strength = average_gain / average_loss
    return 100 - (100 / (1 + relative_strength))


def _atr(candles: list[OhlcvCandle], period: int = 14) -> float | None:
    if len(candles) <= period:
        return None

    true_ranges: list[float] = []
    for index in range(1, len(candles)):
        candle = candles[index]
        previous = candles[index - 1]
        true_ranges.append(
            max(
                candle.high - candle.low,
                abs(candle.high - previous.close),
                abs(candle.low - previous.close),
            ),
        )

    if len(true_ranges) < period:
        return None

    return sum(true_ranges[-period:]) / period


def _trend_direction(ema_fast: float | None, ema_slow: float | None) -> str:
    if ema_fast is None or ema_slow is None or ema_slow == 0:
        return "unknown"

    distance = ((ema_fast - ema_slow) / ema_slow) * 100
    if distance > 0.05:
        return "up"
    if distance < -0.05:
        return "down"
    return "flat"


def _quality_score(feature: dict[str, Any]) -> tuple[int, list[str]]:
    core_fields = [
        "price",
        "volume",
        "emaFast",
        "emaSlow",
        "macd",
        "macdSignal",
        "macdHistogram",
        "rsi",
        "atr",
        "change1h",
        "change4h",
        "change24h",
        "high24h",
        "low24h",
        "volatility",
        "trendDirection",
        "candlePattern",
    ]
    missing = [
        field
        for field in core_fields
        if feature.get(field) is None or feature.get(field) == "" or feature.get(field) == "unknown"
    ]
    available = len(core_fields) - len(missing)
    return round((available / len(core_fields)) * 100), missing


def _parse_candles(payload: dict[str, Any]) -> list[OhlcvCandle]:
    candles = payload.get("candles")
    if not isinstance(candles, list):
        raise MarketServiceError("OHLCV payload is missing candles.", 502)

    parsed: list[OhlcvCandle] = []
    for row in candles:
        if not isinstance(row, dict):
            continue
        timestamp = row.get("timestamp")
        open_ = _number(row.get("open"))
        high = _number(row.get("high"))
        low = _number(row.get("low"))
        close = _number(row.get("close"))
        volume = _number(row.get("volume"))
        if (
            timestamp is None
            or open_ is None
            or high is None
            or low is None
            or close is None
            or volume is None
        ):
            continue
        parsed.append(
            OhlcvCandle(
                timestamp=int(timestamp),
                open=open_,
                high=high,
                low=low,
                close=close,
                volume=volume,
            ),
        )

    return parsed


class FeatureEngine:
    def __init__(self, market_service: MarketService) -> None:
        self.market_service = market_service

    def market_features(
        self,
        exchange: str,
        symbol: str,
        timeframe: str,
        limit: int,
    ) -> dict[str, Any]:
        ohlcv = self.market_service.fetch_ohlcv(exchange, symbol, timeframe, limit)
        ticker = self.market_service.fetch_ticker(exchange, symbol)
        candles = _parse_candles(ohlcv)
        closes = [candle.close for candle in candles]

        latest_close = closes[-1] if closes else None
        price = _number(ticker.get("price")) or latest_close
        volume = _number(ticker.get("volume")) or (candles[-1].volume if candles else None)
        high_24h = _number(ticker.get("high24h"))
        low_24h = _number(ticker.get("low24h"))

        if high_24h is None and candles:
            high_24h = max(candle.high for candle in candles[-24:])
        if low_24h is None and candles:
            low_24h = min(candle.low for candle in candles[-24:])

        ema_fast = _ema(closes, 12)
        ema_slow = _ema(closes, 26)
        macd, macd_signal, macd_histogram = _macd(closes)
        rsi = _rsi(closes)
        atr = _atr(candles)
        change_1h = _percentage_change(price, closes[-2] if len(closes) >= 2 else None)
        change_4h = _percentage_change(price, closes[-5] if len(closes) >= 5 else None)
        change_24h = _number(ticker.get("priceChange24h")) or _percentage_change(
            price,
            closes[-25] if len(closes) >= 25 else None,
        )
        volatility = (
            ((high_24h - low_24h) / price) * 100
            if price is not None and price > 0 and high_24h is not None and low_24h is not None
            else None
        )

        feature: dict[str, Any] = {
            "exchange": exchange.strip().lower(),
            "symbol": ticker.get("symbol") or ohlcv.get("symbol") or symbol,
            "timeframe": timeframe,
            "limit": limit,
            "price": _round(price),
            "volume": _round(volume),
            "emaFast": _round(ema_fast),
            "emaSlow": _round(ema_slow),
            "macd": _round(macd),
            "macdSignal": _round(macd_signal),
            "macdHistogram": _round(macd_histogram),
            "rsi": _round(rsi),
            "atr": _round(atr),
            "change1h": _round(change_1h),
            "change4h": _round(change_4h),
            "change24h": _round(change_24h),
            "high24h": _round(high_24h),
            "low24h": _round(low_24h),
            "volatility": _round(volatility),
            "trendDirection": _trend_direction(ema_fast, ema_slow),
            "candlePattern": "none",
            "source": FEATURE_SOURCE,
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

        data_quality_score, missing_fields = _quality_score(feature)
        feature["dataQualityScore"] = data_quality_score
        feature["missingFields"] = missing_fields
        return feature

    def trade_context_features(
        self,
        exchange: str,
        symbol: str,
        direction: str,
        entry_price: float,
        timeframe: str,
        limit: int,
    ) -> dict[str, Any]:
        normalized_direction = direction.strip().lower()
        if normalized_direction not in {"long", "short"}:
            raise MarketServiceError("direction must be long or short.")

        feature = self.market_features(exchange, symbol, timeframe, limit)
        price = _number(feature.get("price"))
        distance = _percentage_change(price, entry_price)
        trend = feature.get("trendDirection")
        alignment = "unknown"

        if trend == "flat":
            alignment = "neutral"
        elif normalized_direction == "long" and trend == "up":
            alignment = "aligned"
        elif normalized_direction == "short" and trend == "down":
            alignment = "aligned"
        elif normalized_direction == "long" and trend == "down":
            alignment = "against"
        elif normalized_direction == "short" and trend == "up":
            alignment = "against"

        return {
            **feature,
            "entryPrice": entry_price,
            "distanceFromEntryPercent": _round(distance),
            "direction": normalized_direction,
            "trendAlignment": alignment,
        }
