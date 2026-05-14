import { useEffect, useMemo, useRef } from 'react';
import { AreaSeries, ColorType, createChart } from 'lightweight-charts';

function formatSignedChange(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`;
}

function formatSignedRate(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

function buildChartOptions() {
  return {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#8ea0bf',
      fontFamily: 'SUIT, sans-serif',
    },
    grid: {
      vertLines: { color: '#edf3fb' },
      horzLines: { color: '#edf3fb' },
    },
    rightPriceScale: {
      borderVisible: false,
      scaleMargins: { top: 0.16, bottom: 0.14 },
    },
    leftPriceScale: {
      visible: false,
    },
    timeScale: {
      borderVisible: false,
      timeVisible: true,
      secondsVisible: false,
      rightOffset: 6,
      barSpacing: 18,
    },
    crosshair: {
      vertLine: {
        color: 'rgba(63, 134, 255, 0.22)',
        labelBackgroundColor: '#2d72eb',
      },
      horzLine: {
        color: 'rgba(63, 134, 255, 0.22)',
        labelBackgroundColor: '#2d72eb',
      },
    },
    localization: {
      locale: 'ko-KR',
    },
  };
}

function buildSeriesOptions() {
  return {
    lineColor: '#4f8df7',
    topColor: 'rgba(79, 141, 247, 0.32)',
    bottomColor: 'rgba(79, 141, 247, 0.02)',
    lineWidth: 3,
    priceLineVisible: false,
    crosshairMarkerRadius: 4,
    crosshairMarkerBorderColor: '#ffffff',
    crosshairMarkerBackgroundColor: '#4f8df7',
    lastValueVisible: true,
  };
}

function hasPointChanged(previousPoint, nextPoint) {
  if (!previousPoint || !nextPoint) {
    return true;
  }

  return previousPoint.time !== nextPoint.time || previousPoint.value !== nextPoint.value;
}

export default function RealtimePriceChart({
  companyName,
  points,
  currentPrice,
  changeRate,
  isLoading,
  statusMessage,
  statusTone = 'info',
  tradeFeedback,
  onBuyClick,
  onSellClick,
  disableBuy,
  disableSell,
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const previousPointsRef = useRef([]);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, buildChartOptions());
    const areaSeries = chart.addSeries(AreaSeries, buildSeriesOptions());

    chartRef.current = chart;
    seriesRef.current = areaSeries;

    const resizeObserver = new ResizeObserver(() => {
      chart.timeScale().fitContent();
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      previousPointsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) {
      return;
    }

    if (!points.length) {
      seriesRef.current.setData([]);
      previousPointsRef.current = [];
      return;
    }

    const previousPoints = previousPointsRef.current;
    const previousLastPoint = previousPoints[previousPoints.length - 1];
    const nextLastPoint = points[points.length - 1];

    const canIncrementallyUpdate =
      previousPoints.length > 0 &&
      points.length >= previousPoints.length &&
      points.slice(0, previousPoints.length - 1).every((point, index) => {
        const previousPoint = previousPoints[index];
        return previousPoint?.time === point.time && previousPoint?.value === point.value;
      });

    if (canIncrementallyUpdate) {
      if (hasPointChanged(previousLastPoint, nextLastPoint)) {
        seriesRef.current.update(nextLastPoint);
      }

      if (points.length > previousPoints.length) {
        for (let index = previousPoints.length; index < points.length; index += 1) {
          seriesRef.current.update(points[index]);
        }
      }
    } else {
      seriesRef.current.setData(points);
      chartRef.current?.timeScale().fitContent();
    }

    previousPointsRef.current = points;
  }, [points]);

  const latestPoint = points[points.length - 1];
  const previousPoint = points[points.length - 2];

  const headline = useMemo(() => {
    const latestPrice = latestPoint?.value ?? 0;
    const hasServerChangeRate = Number.isFinite(changeRate);
    let resolvedChangeRate = hasServerChangeRate ? changeRate : 0;
    let changeAmount = 0;

    if (hasServerChangeRate && latestPrice > 0) {
      const previousClose = latestPrice / (1 + changeRate / 100);
      changeAmount = latestPrice - previousClose;
    } else {
      const previousPrice = previousPoint?.value ?? latestPrice;
      changeAmount = latestPrice - previousPrice;
      resolvedChangeRate = previousPrice === 0 ? 0 : (changeAmount / previousPrice) * 100;
    }

    return {
      currentPrice: new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
        maximumFractionDigits: 0,
      }).format(latestPrice),
      change: changeAmount,
      changeRate: resolvedChangeRate,
    };
  }, [changeRate, latestPoint, previousPoint]);

  const directionClass = headline.change >= 0 ? 'up' : 'down';

  return (
    <div className="chart-block">
      <div className="price-head">
        <div>
          <h2>{companyName}</h2>
          <div className="price-line">
            <strong>{headline.currentPrice}</strong>
            <span className={directionClass}>
              {formatSignedChange(headline.change)} ({formatSignedRate(headline.changeRate)})
            </span>
          </div>
        </div>
      </div>

      <div className="chart-frame">
        <div ref={containerRef} className="lightweight-chart" />

        {isLoading ? <div className="chart-status">실시간 시세를 불러오는 중입니다.</div> : null}
        {statusMessage && statusTone === 'error' ? (
          <div className={`chart-status ${statusTone}`}>{statusMessage}</div>
        ) : null}
      </div>

      <p className="chart-attribution">
        Market data rendered with TradingView Lightweight Charts.
        <a href="https://www.tradingview.com" target="_blank" rel="noreferrer">
          TradingView
        </a>
      </p>

      {statusMessage && statusTone === 'info' ? <p className="chart-note">{statusMessage}</p> : null}

      <div className="trade-bar">
        <div className="trade-bar-meta">
          <span>현재 거래 기준가</span>
          <strong>
            {new Intl.NumberFormat('ko-KR', {
              style: 'currency',
              currency: 'KRW',
              maximumFractionDigits: 0,
            }).format(currentPrice)}
          </strong>
        </div>

        <div className="trade-bar-actions">
          <button type="button" className="trade-button sell" onClick={onSellClick} disabled={disableSell}>
            매도
          </button>
          <button type="button" className="trade-button buy" onClick={onBuyClick} disabled={disableBuy}>
            매수
          </button>
        </div>
      </div>

      {tradeFeedback ? <p className="trade-feedback">{tradeFeedback}</p> : null}
    </div>
  );
}
