from __future__ import annotations

import math
from dataclasses import dataclass
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


def _to_ccxt_symbol(symbol: str) -> str:
    normalized = symbol.strip().upper()
    if not normalized:
        raise MarketServiceError("symbol is required.")

    if "/" in normalized and ":" in normalized:
        return normalized

    clean = normalized.replace("-", "/")
    parts = [part for part in clean.split("/") if part and part != "SWAP"]
    base = parts[0]
    quote = parts[1] if len(parts) >= 2 else "USDT"

    if normalized.endswith("-USDT-SWAP"):
        return f"{base}/{quote}:{quote}"

    if "/" in normalized:
        return f"{base}/{quote}"

    return f"{base}/{quote}"


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
        ccxt_symbol = _to_ccxt_symbol(symbol)
        try:
            exchange = self._exchange(normalized_exchange)
            ticker = exchange.fetch_ticker(ccxt_symbol)
        except Exception as error:
            raise MarketServiceError(str(error), 502) from error

        return {
            "exchange": normalized_exchange,
            "symbol": ticker.get("symbol") or ccxt_symbol,
            "price": _number(ticker.get("last")),
            "bid": _number(ticker.get("bid")),
            "ask": _number(ticker.get("ask")),
            "high24h": _number(ticker.get("high")),
            "low24h": _number(ticker.get("low")),
            "volume": _number(ticker.get("baseVolume")),
            "quoteVolume": _number(ticker.get("quoteVolume")),
            "priceChange24h": _number(ticker.get("percentage")),
            "timestamp": ticker.get("timestamp"),
            "datetime": ticker.get("datetime"),
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
        ccxt_symbol = _to_ccxt_symbol(symbol)
        safe_limit = _safe_limit(limit)
        try:
            exchange = self._exchange(normalized_exchange)
            rows = exchange.fetch_ohlcv(ccxt_symbol, timeframe=timeframe, limit=safe_limit)
        except Exception as error:
            raise MarketServiceError(str(error), 502) from error

        candles = [_parse_ohlcv(row) for row in rows]
        return {
            "exchange": normalized_exchange,
            "symbol": ccxt_symbol,
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
