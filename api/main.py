from __future__ import annotations

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .feature_engine import FeatureEngine
from .market_service import MarketService, MarketServiceError


app = FastAPI(
    title="AlphaPilot Market API",
    version="5.0.0",
    description="Public market data and feature service. No trading permissions or orders.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET"],
    allow_headers=["*"],
)

market_service = MarketService()
feature_engine = FeatureEngine(market_service)


@app.exception_handler(MarketServiceError)
async def market_service_error_handler(
    _: Request,
    error: MarketServiceError,
) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"detail": error.message},
    )


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "AlphaPilot Market API",
        "version": "5.0.0",
        "permissions": "public_market_data_only",
    }


@app.get("/market/ticker")
def ticker(
    exchange: str = Query("okx", min_length=2),
    symbol: str = Query(..., min_length=3, examples=["BTC/USDT"]),
) -> dict[str, object]:
    return market_service.fetch_ticker(exchange, symbol)


@app.get("/market/ohlcv")
def ohlcv(
    exchange: str = Query("okx", min_length=2),
    symbol: str = Query(..., min_length=3, examples=["BTC/USDT"]),
    timeframe: str = Query("1m", min_length=1, examples=["1m"]),
    limit: int = Query(200, ge=1, le=500),
) -> dict[str, object]:
    return market_service.fetch_ohlcv(exchange, symbol, timeframe, limit)


@app.get("/market/features")
def features(
    exchange: str = Query("okx", min_length=2),
    symbol: str = Query(..., min_length=3, examples=["BTC/USDT"]),
) -> dict[str, object]:
    return market_service.fetch_features(exchange, symbol)


@app.get("/features/market")
def market_features(
    exchange: str = Query("okx", min_length=2),
    symbol: str = Query(..., min_length=3, examples=["BTC/USDT"]),
    timeframe: str = Query("1h", min_length=1, examples=["1h"]),
    limit: int = Query(200, ge=1, le=500),
) -> dict[str, object]:
    return feature_engine.market_features(exchange, symbol, timeframe, limit)


@app.get("/features/trade-context")
def trade_context_features(
    exchange: str = Query("okx", min_length=2),
    symbol: str = Query(..., min_length=3, examples=["BTC/USDT"]),
    direction: str = Query(..., min_length=4, examples=["long"]),
    entryPrice: float = Query(..., gt=0),
    timeframe: str = Query("1h", min_length=1, examples=["1h"]),
    limit: int = Query(200, ge=1, le=500),
) -> dict[str, object]:
    return feature_engine.trade_context_features(
        exchange=exchange,
        symbol=symbol,
        direction=direction,
        entry_price=entryPrice,
        timeframe=timeframe,
        limit=limit,
    )
