from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

import ccxt


SUPPORTED_EXCHANGES = {"okx": ccxt.okx}


class MarketServiceError(Exception):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


@dataclass(frozen=True)
class OhlcvCandle:
    timestamp: int
    open: float
    high: float
    low: float
    close: float
    volume: float


def _number(value: Any) -> float | None:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return None
    return parsed if math.isfinite(parsed) else None


def _percentage_change(current: float | None, previous: float | None) -> float | None:
    if current is None or previous is None or previous == 0:
        return None
    return ((current - previous) / previous) * 100


def _trend_direction(candles: list[OhlcvCandle]) -> str:
    if len(candles) < 2:
        return "unknown"

    first_close = candles[0].close
    last_close = candles[-1].close
    if first_close <= 0:
        return "unknown"

    change = ((last_close - first_close) / first_close) * 100
    if change > 0.2:
        return "up"
    if change < -0.2:
        return "down"
    return "flat"


def _safe_limit(limit: int) -> int:
    if limit < 1:
        raise MarketServiceError("limit must be at least 1.")
    return min(limit, 500)


def _okx_timeframe(timeframe: str) -> str:
    normalized = timeframe.strip()
    mapping = {
        "1m": "1m",
        "3m": "3m",
        "5m": "5m",
        "15m": "15m",
        "30m": "30m",
        "1h": "1H",
        "2h": "2H",
        "4h": "4H",
        "6h": "6H",
        "12h": "12H",
        "1d": "1D",
        "1w": "1W",
        "1M": "1M",
    }
    return mapping.get(normalized, normalized)


def _timestamp_to_datetime(timestamp: int | None) -> str | None:
    if timestamp is None:
        return None
    return datetime.fromtimestamp(timestamp / 1000, timezone.utc).isoformat()


def _to_okx_inst_id(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise MarketServiceError("symbol is required.")

    clean = normalized.replace(":", "/").replace("-", "/")
    parts = [part for part in clean.split("/") if part and part != "SWAP"]
    base = parts[0]
    quote = parts[1] if len(parts) >= 2 else "USDT"

    if normalized.endswith("-USDT-SWAP") or normalized.endswith("/USDT:USDT"):
        return f"{base}-{quote}-SWAP"

    return f"{base}-{quote}"


def _display_symbol(symbol: str, inst_id: str) -> str:
    normalized = symbol.strip().upper()
    if "/" in normalized:
        return normalized

    if inst_id.endswith("-SWAP"):
        base, quote, _ = inst_id.split("-", 2)
        return f"{base}/{quote}:USDT"

    return inst_id.replace("-", "/")


def _first_data_row(response: Any, label: str) -> dict[str, Any]:
    data = response.get("data") if isinstance(response, dict) else None
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        raise MarketServiceError(f"OKX returned an invalid {label} response.", 502)
    return data[0]


def _data_rows(response: Any, label: str) -> list[list[Any]]:
    data = response.get("data") if isinstance(response, dict) else None
    if not isinstance(data, list):
        raise MarketServiceError(f"OKX returned an invalid {label} response.", 502)
    return [row for row in data if isinstance(row, list)]


def _parse_ohlcv(row: list[Any]) -> OhlcvCandle:
    if len(row) < 6:
        raise MarketServiceError("Exchange returned an invalid OHLCV row.", 502)

    timestamp = int(row[0])
    values = [_number(value) for value in row[1:6]]
    if any(value is None for value in values):
        raise MarketServiceError("Exchange returned a non-numeric OHLCV row.", 502)

    open_, high, low, close, volume = values
    return OhlcvCandle(
        timestamp=timestamp,
        open=open_ or 0,
        high=high or 0,
        low=low or 0,
        close=close or 0,
        volume=volume or 0,
    )


class MarketService:
    def __init__(self) -> None:
        self._exchanges: dict[str, Any] = {}

    def _normalize_exchange(self, exchange_id: str) -> str:
        normalized = exchange_id.strip().lower()
        if normalized not in SUPPORTED_EXCHANGES:
            raise MarketServiceError(
                f"Unsupported exchange: {exchange_id}. Only okx is enabled in V4.",
            )
        return normalized

    def _exchange(self, exchange_id: str) -> Any:
        normalized = self._normalize_exchange(exchange_id)
        exchange_class = SUPPORTED_EXCHANGES[normalized]

        if normalized not in self._exchanges:
            self._exchanges[normalized] = exchange_class(
                {
                    "enableRateLimit": True,
                    "options": {"defaultType": "spot"},
                },
            )

        return self._exchanges[normalized]

    def fetch_ticker(self, exchange_id: str, symbol: str) -> dict[str, Any]:
        normalized_exchange = self._normalize_exchange(exchange_id)
        inst_id = _to_okx_inst_id(symbol)
        try:
            exchange = self._exchange(normalized_exchange)
            response = exchange.public_get_market_ticker({"instId": inst_id})
        except Exception as error:
            raise MarketServiceError(str(error), 502) from error

        ticker = _first_data_row(response, "ticker")
        price = _number(ticker.get("last"))
        open_24h = _number(ticker.get("open24h")) or _number(ticker.get("sodUtc8"))
        timestamp = int(ticker["ts"]) if str(ticker.get("ts", "")).isdigit() else None

        return {
            "exchange": normalized_exchange,
            "symbol": _display_symbol(symbol, inst_id),
            "price": price,
            "bid": _number(ticker.get("bidPx")),
            "ask": _number(ticker.get("askPx")),
            "high24h": _number(ticker.get("high24h")),
            "low24h": _number(ticker.get("low24h")),
            "volume": _number(ticker.get("vol24h")),
            "quoteVolume": _number(ticker.get("volCcy24h")),
            "priceChange24h": _percentage_change(price, open_24h),
            "timestamp": timestamp,
            "datetime": _timestamp_to_datetime(timestamp),
            "source": "ccxt_public",
        }

    def fetch_ohlcv(
        self,
        exchange_id: str,
        symbol: str,
        timeframe: str,
        limit: int,
    ) -> dict[str, Any]:
        normalized_exchange = self._normalize_exchange(exchange_id)
        inst_id = _to_okx_inst_id(symbol)
        safe_limit = _safe_limit(limit)
        try:
            exchange = self._exchange(normalized_exchange)
            response = exchange.public_get_market_candles(
                {"instId": inst_id, "bar": _okx_timeframe(timeframe), "limit": safe_limit},
            )
        except Exception as error:
            raise MarketServiceError(str(error), 502) from error

        rows = list(reversed(_data_rows(response, "OHLCV")))
        candles = [_parse_ohlcv(row) for row in rows]
        return {
            "exchange": normalized_exchange,
            "symbol": _display_symbol(symbol, inst_id),
            "timeframe": timeframe,
            "limit": safe_limit,
            "candles": [candle.__dict__ for candle in candles],
            "source": "ccxt_public",
        }

    def fetch_features(self, exchange_id: str, symbol: str) -> dict[str, Any]:
        ticker = self.fetch_ticker(exchange_id, symbol)
        hourly = self.fetch_ohlcv(exchange_id, symbol, "1h", 6)
        candles = [OhlcvCandle(**candle) for candle in hourly["candles"]]

        price = ticker["price"]
        close_1h_ago = candles[-2].close if len(candles) >= 2 else None
        close_4h_ago = candles[-5].close if len(candles) >= 5 else None
        high_24h = ticker["high24h"]
        low_24h = ticker["low24h"]
        volatility = None
        if price and price > 0 and high_24h is not None and low_24h is not None:
            volatility = ((high_24h - low_24h) / price) * 100

        return {
            "exchange": exchange_id.strip().lower(),
            "symbol": ticker["symbol"],
            "price": price,
            "volume": ticker["volume"],
            "priceChange1h": _percentage_change(price, close_1h_ago),
            "priceChange4h": _percentage_change(price, close_4h_ago),
            "priceChange24h": ticker["priceChange24h"],
            "high24h": high_24h,
            "low24h": low_24h,
            "volatility": volatility,
            "trendDirection": _trend_direction(candles),
            "source": "ccxt_public",
        }
