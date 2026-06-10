import { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickSeries, ColorType, HistogramSeries, LineSeries, createChart } from 'lightweight-charts';

const INITIAL_VISIBLE_BAR_COUNT = 24;
const MIN_VISIBLE_BAR_COUNT = 8;
const WHEEL_ZOOM_STEP = 0.12;
const MOVING_AVERAGE_COLORS = ['#16a34a', '#dc2626', '#f97316', '#7e22ce', '#2563eb', '#ca8a04'];
const DEFAULT_MOVING_AVERAGES = [
  { id: 'ma-5', period: 5, color: MOVING_AVERAGE_COLORS[0], lineWidth: 1 },
  { id: 'ma-20', period: 20, color: MOVING_AVERAGE_COLORS[1], lineWidth: 1 },
];
const DEFAULT_RSI_CONFIG = {
  enabled: false,
  period: 14,
  color: '#7c3aed',
  lineWidth: 2,
};
const RSI_PRICE_RANGE = {
  minValue: 0,
  maxValue: 100,
};
const RSI_SCALE_MARGIN_TOP = 0.04;
const RSI_SCALE_MARGIN_BOTTOM = 0.04;

function formatSignedChange(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('ko-KR').format(Math.round(value))}`;
}

function formatSignedRate(value) {
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
}

function formatPercentFromOpen(open, value) {
  if (!Number.isFinite(open) || open === 0 || !Number.isFinite(value)) {
    return '+0.00%';
  }

  const rate = ((value - open) / open) * 100;
  const prefix = rate > 0 ? '+' : '';
  return `${prefix}${rate.toFixed(2)}%`;
}

function buildMovingAverageData(points, period) {
  const normalizedPeriod = Math.max(1, Math.floor(Number(period) || 0));
  if (!normalizedPeriod || !Array.isArray(points) || !points.length) {
    return [];
  }

  const result = [];
  let rollingSum = 0;

  points.forEach((point, index) => {
    const value = Number(point?.value);
    rollingSum += value;

    if (index >= normalizedPeriod) {
      rollingSum -= Number(points[index - normalizedPeriod]?.value ?? 0);
    }

    if (index >= normalizedPeriod - 1) {
      result.push({
        time: point.time,
        value: rollingSum / normalizedPeriod,
      });
    }
  });

  return result;
}

function buildRsiData(points, period) {
  const normalizedPeriod = Math.max(2, Math.floor(Number(period) || 0));
  if (!normalizedPeriod || !Array.isArray(points) || points.length <= normalizedPeriod) {
    return [];
  }

  const values = points.map((point) => Number(point?.value ?? 0));
  let gains = 0;
  let losses = 0;

  for (let index = 1; index <= normalizedPeriod; index += 1) {
    const change = values[index] - values[index - 1];
    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  let averageGain = gains / normalizedPeriod;
  let averageLoss = losses / normalizedPeriod;
  const result = [];

  function calculateRsi(avgGain, avgLoss) {
    if (avgLoss === 0) {
      return 100;
    }
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  result.push({
    time: points[normalizedPeriod].time,
    value: calculateRsi(averageGain, averageLoss),
  });

  for (let index = normalizedPeriod + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    averageGain = (averageGain * (normalizedPeriod - 1) + gain) / normalizedPeriod;
    averageLoss = (averageLoss * (normalizedPeriod - 1) + loss) / normalizedPeriod;

    result.push({
      time: points[index].time,
      value: calculateRsi(averageGain, averageLoss),
    });
  }

  return result;
}

function buildFixedPriceRangeProvider(minValue, maxValue) {
  return () => ({
    priceRange: {
      minValue,
      maxValue,
    },
  });
}

function buildChartOptions(pinFirstCandleLeft, showVolume) {
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
      rightOffset: pinFirstCandleLeft ? 0 : 6,
      barSpacing: 18,
      fixLeftEdge: pinFirstCandleLeft,
      lockVisibleTimeRangeOnResize: true,
      shiftVisibleRangeOnNewBar: !pinFirstCandleLeft,
    },
    handleScroll: {
      mouseWheel: false,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      mouseWheel: false,
      pinch: true,
      axisPressedMouseMove: true,
    },
    crosshair: {
      vertLine: {
        color: 'rgba(44, 95, 184, 0.42)',
        labelBackgroundColor: '#2d72eb',
      },
      horzLine: {
        color: 'rgba(44, 95, 184, 0.42)',
        labelBackgroundColor: '#2d72eb',
      },
    },
    localization: {
      locale: 'ko-KR',
    },
    panes: {
      enableResize: false,
      separatorColor: showVolume ? 'rgba(84, 104, 138, 0.9)' : 'transparent',
      separatorHoverColor: 'rgba(84, 104, 138, 0.9)',
    },
  };
}

function buildLineSeriesOptions() {
  return {
    color: '#4f8df7',
    lineWidth: 3,
    priceLineVisible: false,
    crosshairMarkerRadius: 4,
    crosshairMarkerBorderColor: '#ffffff',
    crosshairMarkerBackgroundColor: '#4f8df7',
    lastValueVisible: true,
  };
}

function buildCandlestickSeriesOptions() {
  return {
    upColor: '#ff6d6f',
    downColor: '#2f74ec',
    borderVisible: false,
    wickUpColor: '#ff6d6f',
    wickDownColor: '#2f74ec',
    priceLineVisible: false,
    lastValueVisible: true,
  };
}

function buildVolumeSeriesOptions() {
  return {
    priceLineVisible: false,
    lastValueVisible: false,
    base: 0,
    priceFormat: {
      type: 'volume',
    },
  };
}

function toCandlestickData(points) {
  if (!points.length) {
    return [];
  }

  return points.map((point, index) => {
    const previousPoint = points[index - 1] ?? point;
    const open = previousPoint.value;
    const close = point.value;

    return {
      time: point.time,
      open,
      high: Math.max(open, close),
      low: Math.min(open, close),
      close,
    };
  });
}

export default function RealtimePriceChart({
  companyName,
  points,
  candlestickPoints,
  volumePoints,
  averagePrice = 0,
  currentPrice,
  currentHighPrice,
  currentLowPrice,
  currentReturnRate = 0,
  changeRate,
  isLoading,
  statusMessage,
  statusTone = 'info',
  tradeFeedback,
  onBuyClick,
  onSellClick,
  onAuxClick,
  auxButtonLabel,
  disableBuy,
  disableSell,
  disableAuxButton,
  hideFooterText = false,
  pinFirstCandleLeft = false,
}) {
  const [chartType, setChartType] = useState('line');
  const [isIndicatorMenuOpen, setIsIndicatorMenuOpen] = useState(false);
  const [selectedIndicatorPanel, setSelectedIndicatorPanel] = useState(null);
  const [movingAverages, setMovingAverages] = useState(DEFAULT_MOVING_AVERAGES);
  const [rsiConfig, setRsiConfig] = useState(DEFAULT_RSI_CONFIG);
  const [hoveredCandle, setHoveredCandle] = useState(null);
  const [hoveredVolume, setHoveredVolume] = useState(null);
  const [hoveredRsi, setHoveredRsi] = useState(null);
  const indicatorMenuRef = useRef(null);
  const frameRef = useRef(null);
  const containerRef = useRef(null);
  const chartRef = useRef(null);
  const lineSeriesRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const volumeSeriesRef = useRef(null);
  const rsiSeriesRef = useRef(null);
  const rsiUpperSeriesRef = useRef(null);
  const rsiLowerSeriesRef = useRef(null);
  const movingAverageSeriesRefs = useRef(new Map());
  const hasAppliedInitialRangeRef = useRef(false);
  const latestLogicalLengthRef = useRef(0);
  const hasVolume = Array.isArray(volumePoints) && volumePoints.length > 0;
  const hasRsiPane = !!rsiConfig.enabled;
  const volumePaneIndex = 1;
  const rsiPaneIndex = 2;
  const resolvedCandlestickPoints = useMemo(
    () => (Array.isArray(candlestickPoints) && candlestickPoints.length ? candlestickPoints : toCandlestickData(points)),
    [candlestickPoints, points],
  );

  useEffect(() => {
    function handlePointerDown(event) {
      if (!indicatorMenuRef.current || indicatorMenuRef.current.contains(event.target)) {
        return;
      }
      setIsIndicatorMenuOpen(false);
      setSelectedIndicatorPanel(null);
    }

    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) {
      return undefined;
    }

    const chart = createChart(containerRef.current, buildChartOptions(pinFirstCandleLeft, true));
    while (chart.panes().length < 3) {
      chart.addPane(true);
    }
    chartRef.current = chart;

    return () => {
      chart.remove();
      chartRef.current = null;
      lineSeriesRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      rsiSeriesRef.current = null;
      rsiUpperSeriesRef.current = null;
      rsiLowerSeriesRef.current = null;
      movingAverageSeriesRefs.current.clear();
    };
  }, [pinFirstCandleLeft]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || chart.panes().length < 3) {
      return;
    }

    if (hasVolume && hasRsiPane) {
      chart.panes()[0].setStretchFactor(0.58);
      chart.panes()[volumePaneIndex].setStretchFactor(0.2);
      chart.panes()[rsiPaneIndex].setStretchFactor(0.22);
      return;
    }

    if (hasVolume) {
      chart.panes()[0].setStretchFactor(0.78);
      chart.panes()[volumePaneIndex].setStretchFactor(0.22);
      chart.panes()[rsiPaneIndex].setStretchFactor(0.01);
      return;
    }

    if (hasRsiPane) {
      chart.panes()[0].setStretchFactor(0.74);
      chart.panes()[volumePaneIndex].setStretchFactor(0.01);
      chart.panes()[rsiPaneIndex].setStretchFactor(0.25);
      return;
    }

    chart.panes()[0].setStretchFactor(1);
    chart.panes()[volumePaneIndex].setStretchFactor(0.01);
    chart.panes()[rsiPaneIndex].setStretchFactor(0.01);
  }, [hasRsiPane, hasVolume]);

  useEffect(() => {
    const chart = chartRef.current;
    const frame = frameRef.current;

    if (!chart || !frame || !hasVolume) {
      return undefined;
    }

    const resizeObservers = [];

    function syncVolumeHeaderPosition() {
      const panes = chart.panes();
      if (panes.length <= volumePaneIndex) {
        return;
      }

      const volumePaneElement = panes[volumePaneIndex].getHTMLElement();
      if (!volumePaneElement) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const volumePaneRect = volumePaneElement.getBoundingClientRect();
      const relativeTop = Math.max(0, volumePaneRect.top - frameRect.top);
      frame.style.setProperty('--volume-pane-start', `${relativeTop}px`);
    }

    syncVolumeHeaderPosition();

    const frameResizeObserver = new ResizeObserver(() => {
      syncVolumeHeaderPosition();
    });
    resizeObservers.push(frameResizeObserver);

    frameResizeObserver.observe(frame);

    const panes = chart.panes();
    if (panes.length > volumePaneIndex) {
      const pricePaneElement = panes[0].getHTMLElement();
      const volumePaneElement = panes[volumePaneIndex].getHTMLElement();

      if (pricePaneElement) {
        const pricePaneResizeObserver = new ResizeObserver(() => {
          syncVolumeHeaderPosition();
        });
        pricePaneResizeObserver.observe(pricePaneElement);
        resizeObservers.push(pricePaneResizeObserver);
      }

      if (volumePaneElement) {
        const volumePaneResizeObserver = new ResizeObserver(() => {
          syncVolumeHeaderPosition();
        });
        volumePaneResizeObserver.observe(volumePaneElement);
        resizeObservers.push(volumePaneResizeObserver);
      }
    }

    chart.subscribeCrosshairMove(syncVolumeHeaderPosition);

    return () => {
      resizeObservers.forEach((observer) => observer.disconnect());
      chart.unsubscribeCrosshairMove(syncVolumeHeaderPosition);
    };
  }, [hasVolume, chartType, points.length, resolvedCandlestickPoints.length]);

  useEffect(() => {
    const chart = chartRef.current;
    const frame = frameRef.current;

    if (!chart || !frame || !hasRsiPane) {
      return undefined;
    }

    const resizeObservers = [];

    function syncRsiPanePosition() {
      const panes = chart.panes();
      if (panes.length <= rsiPaneIndex) {
        return;
      }

      const rsiPaneElement = panes[rsiPaneIndex].getHTMLElement();
      if (!rsiPaneElement) {
        return;
      }

      const frameRect = frame.getBoundingClientRect();
      const rsiPaneRect = rsiPaneElement.getBoundingClientRect();
      const relativeTop = Math.max(0, rsiPaneRect.top - frameRect.top);
      frame.style.setProperty('--rsi-pane-start', `${relativeTop}px`);
      frame.style.setProperty('--rsi-pane-height', `${Math.max(0, rsiPaneRect.height)}px`);
    }

    syncRsiPanePosition();

    const frameResizeObserver = new ResizeObserver(() => {
      syncRsiPanePosition();
    });
    frameResizeObserver.observe(frame);
    resizeObservers.push(frameResizeObserver);

    const panes = chart.panes();
    if (panes.length > rsiPaneIndex) {
      const rsiPaneElement = panes[rsiPaneIndex].getHTMLElement();
      if (rsiPaneElement) {
        const rsiPaneResizeObserver = new ResizeObserver(() => {
          syncRsiPanePosition();
        });
        rsiPaneResizeObserver.observe(rsiPaneElement);
        resizeObservers.push(rsiPaneResizeObserver);
      }
    }

    chart.subscribeCrosshairMove(syncRsiPanePosition);

    return () => {
      resizeObservers.forEach((observer) => observer.disconnect());
      chart.unsubscribeCrosshairMove(syncRsiPanePosition);
    };
  }, [hasRsiPane, points.length, resolvedCandlestickPoints.length]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return undefined;
    }

    if (hasVolume && !volumeSeriesRef.current) {
      volumeSeriesRef.current = chart.addSeries(HistogramSeries, {
        ...buildVolumeSeriesOptions(),
        priceScaleId: 'volume',
      }, volumePaneIndex);
      chart.priceScale('volume', volumePaneIndex).applyOptions({
        visible: true,
        borderVisible: false,
        scaleMargins: { top: 0.18, bottom: 0.08 },
      });
    }

    if (!hasVolume && volumeSeriesRef.current) {
      chart.removeSeries(volumeSeriesRef.current);
      volumeSeriesRef.current = null;
    }

    if (hasRsiPane && !rsiSeriesRef.current) {
      rsiSeriesRef.current = chart.addSeries(
        LineSeries,
        {
          color: rsiConfig.color,
          lineWidth: rsiConfig.lineWidth,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          priceFormat: {
            type: 'price',
            precision: 1,
            minMove: 0.1,
          },
          autoscaleInfoProvider: buildFixedPriceRangeProvider(RSI_PRICE_RANGE.minValue, RSI_PRICE_RANGE.maxValue),
        },
        rsiPaneIndex,
      );
      rsiUpperSeriesRef.current = chart.addSeries(
        LineSeries,
        {
          color: 'rgba(124, 58, 237, 0.38)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        rsiPaneIndex,
      );
      rsiLowerSeriesRef.current = chart.addSeries(
        LineSeries,
        {
          color: 'rgba(124, 58, 237, 0.38)',
          lineWidth: 1,
          lineStyle: 2,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        rsiPaneIndex,
      );
      chart.priceScale('right', rsiPaneIndex).applyOptions({
        visible: true,
        borderVisible: false,
        scaleMargins: { top: RSI_SCALE_MARGIN_TOP, bottom: RSI_SCALE_MARGIN_BOTTOM },
        autoScale: true,
        minimumWidth: 54,
      });
    }

    if (!hasRsiPane && rsiSeriesRef.current) {
      chart.removeSeries(rsiSeriesRef.current);
      rsiSeriesRef.current = null;
    }
    if (!hasRsiPane && rsiUpperSeriesRef.current) {
      chart.removeSeries(rsiUpperSeriesRef.current);
      rsiUpperSeriesRef.current = null;
    }
    if (!hasRsiPane && rsiLowerSeriesRef.current) {
      chart.removeSeries(rsiLowerSeriesRef.current);
      rsiLowerSeriesRef.current = null;
    }

    return () => {
      if (volumeSeriesRef.current) {
        chart.removeSeries(volumeSeriesRef.current);
        volumeSeriesRef.current = null;
      }
      if (rsiSeriesRef.current) {
        chart.removeSeries(rsiSeriesRef.current);
        rsiSeriesRef.current = null;
      }
      if (rsiUpperSeriesRef.current) {
        chart.removeSeries(rsiUpperSeriesRef.current);
        rsiUpperSeriesRef.current = null;
      }
      if (rsiLowerSeriesRef.current) {
        chart.removeSeries(rsiLowerSeriesRef.current);
        rsiLowerSeriesRef.current = null;
      }
    };
  }, [hasRsiPane, hasVolume, rsiConfig.color, rsiConfig.lineWidth]);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart) {
      return undefined;
    }

    if (!lineSeriesRef.current) {
      lineSeriesRef.current = chart.addSeries(LineSeries, buildLineSeriesOptions(), 0);
    }
    if (!candleSeriesRef.current) {
      candleSeriesRef.current = chart.addSeries(CandlestickSeries, buildCandlestickSeriesOptions(), 0);
    }

    hasAppliedInitialRangeRef.current = false;

    return () => {
      if (lineSeriesRef.current) {
        chart.removeSeries(lineSeriesRef.current);
        lineSeriesRef.current = null;
      }
      if (candleSeriesRef.current) {
        chart.removeSeries(candleSeriesRef.current);
        candleSeriesRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;

    if (!chart || !lineSeriesRef.current || !candleSeriesRef.current) {
      return undefined;
    }

    const existingSeriesMap = movingAverageSeriesRefs.current;
    const nextIds = new Set(movingAverages.map((item) => item.id));

    for (const [id, series] of existingSeriesMap.entries()) {
      if (!nextIds.has(id)) {
        chart.removeSeries(series);
        existingSeriesMap.delete(id);
      }
    }

    movingAverages.forEach((item) => {
      if (existingSeriesMap.has(item.id)) {
        return;
      }

      const maSeries = chart.addSeries(
        LineSeries,
        {
          color: item.color,
          lineWidth: item.lineWidth ?? 1,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        },
        0,
      );
      existingSeriesMap.set(item.id, maSeries);
    });

    return () => {
      // Keep series mounted across renders; cleanup happens on unmount/removal.
    };
  }, [movingAverages]);

  useEffect(() => {
    if (!lineSeriesRef.current || !candleSeriesRef.current) {
      return;
    }

    const lineData = chartType === 'line' ? points : [];
    const candleData = chartType === 'candle' ? resolvedCandlestickPoints : [];
    const nextData = chartType === 'candle' ? resolvedCandlestickPoints : points;
    latestLogicalLengthRef.current = nextData.length;
    lineSeriesRef.current.setData(lineData);
    candleSeriesRef.current.setData(candleData);
    if (volumeSeriesRef.current) {
      volumeSeriesRef.current.setData(volumePoints ?? []);
    }
    if (rsiSeriesRef.current) {
      rsiSeriesRef.current.applyOptions({ color: rsiConfig.color, lineWidth: rsiConfig.lineWidth });
      const rsiData = buildRsiData(points, rsiConfig.period);
      rsiSeriesRef.current.setData(rsiData);
      if (rsiUpperSeriesRef.current) {
        rsiUpperSeriesRef.current.setData(
          rsiData.map((item) => ({
            time: item.time,
            value: 70,
          })),
        );
      }
      if (rsiLowerSeriesRef.current) {
        rsiLowerSeriesRef.current.setData(
          rsiData.map((item) => ({
            time: item.time,
            value: 30,
          })),
        );
      }
    }
    movingAverages.forEach((item) => {
      const maSeries = movingAverageSeriesRefs.current.get(item.id);
      if (!maSeries) {
        return;
      }
      maSeries.applyOptions({ color: item.color, lineWidth: item.lineWidth ?? 1 });
      maSeries.setData(buildMovingAverageData(points, item.period));
    });

    if (!pinFirstCandleLeft || hasAppliedInitialRangeRef.current || !chartRef.current || !nextData.length) {
      return;
    }

    const visibleTo = Math.max(nextData.length - 0.5, INITIAL_VISIBLE_BAR_COUNT - 0.5);
    chartRef.current.timeScale().setVisibleLogicalRange({
      from: -0.5,
      to: visibleTo,
    });
    hasAppliedInitialRangeRef.current = true;
  }, [pinFirstCandleLeft, resolvedCandlestickPoints, chartType, points, volumePoints, movingAverages, rsiConfig]);

  useEffect(() => {
    const container = containerRef.current;
    const chart = chartRef.current;

    if (!container || !chart) {
      return undefined;
    }

    function handleWheel(event) {
      if (event.deltaY === 0) {
        return;
      }

      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      if (!visibleRange) {
        return;
      }

      event.preventDefault();

      const currentSpan = Math.max(visibleRange.to - visibleRange.from, MIN_VISIBLE_BAR_COUNT);
      const zoomMultiplier = event.deltaY < 0 ? 1 - WHEEL_ZOOM_STEP : 1 + WHEEL_ZOOM_STEP;
      const maxVisibleBars = Math.max(latestLogicalLengthRef.current + 12, INITIAL_VISIBLE_BAR_COUNT);
      const nextSpan = Math.min(Math.max(currentSpan * zoomMultiplier, MIN_VISIBLE_BAR_COUNT), maxVisibleBars);
      const center = (visibleRange.from + visibleRange.to) / 2;

      chart.timeScale().setVisibleLogicalRange({
        from: center - nextSpan / 2,
        to: center + nextSpan / 2,
      });
    }

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    const series = candleSeriesRef.current;
    const volumeSeries = volumeSeriesRef.current;
    const rsiSeries = rsiSeriesRef.current;

    if (!chart || !series) {
      return undefined;
    }

    function handleCrosshairMove(param) {
      if (!param?.point || !param?.seriesData) {
        setHoveredCandle(null);
        setHoveredVolume(null);
        setHoveredRsi(null);
        return;
      }

      if (chartType === 'candle') {
        const candleData = param.seriesData.get(series);
        if (
          candleData &&
          typeof candleData.open === 'number' &&
          typeof candleData.high === 'number' &&
          typeof candleData.low === 'number' &&
          typeof candleData.close === 'number'
        ) {
          setHoveredCandle({
            open: candleData.open,
            high: candleData.high,
            low: candleData.low,
            close: candleData.close,
          });
        } else {
          setHoveredCandle(null);
        }
      } else {
        setHoveredCandle(null);
      }

      if (volumeSeries) {
        const volumeData = param.seriesData.get(volumeSeries);
        if (volumeData && typeof volumeData.value === 'number') {
          setHoveredVolume(volumeData.value);
        } else {
          setHoveredVolume(null);
        }
      } else {
        setHoveredVolume(null);
      }

      if (rsiSeries) {
        const rsiData = param.seriesData.get(rsiSeries);
        if (rsiData && typeof rsiData.value === 'number') {
          setHoveredRsi(rsiData.value);
          return;
        }
      }

      setHoveredRsi(null);
    }

    chart.subscribeCrosshairMove(handleCrosshairMove);

    return () => {
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
    };
  }, [chartType, resolvedCandlestickPoints, volumePoints]);

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
  const returnRateClass = currentReturnRate >= 0 ? 'up' : 'down';
  const candleInfo = hoveredCandle;

  function handleAddMovingAverage() {
    const nextIndex = movingAverages.length;
    const nextColor = MOVING_AVERAGE_COLORS[nextIndex % MOVING_AVERAGE_COLORS.length];
    const lastPeriod = movingAverages[movingAverages.length - 1]?.period ?? 20;
    const nextPeriod = Math.max(2, Number(lastPeriod) + 20);

    setMovingAverages((current) => [
      ...current,
      {
        id: `ma-${Date.now()}-${current.length}`,
        period: nextPeriod,
        color: nextColor,
        lineWidth: 1,
      },
    ]);
  }

  function handleMovingAveragePeriodChange(id, value) {
    const normalizedValue = String(value).replaceAll(/[^0-9]/g, '');
    setMovingAverages((current) =>
      current.map((item) => (item.id === id ? { ...item, period: normalizedValue === '' ? '' : Number(normalizedValue) } : item)),
    );
  }

  function handleRemoveMovingAverage(id) {
    setMovingAverages((current) => current.filter((item) => item.id !== id));
  }

  function handleMovingAverageColorChange(id, color) {
    setMovingAverages((current) => current.map((item) => (item.id === id ? { ...item, color } : item)));
  }

  function handleMovingAverageWidthChange(id, lineWidth) {
    const normalizedWidth = Math.max(1, Math.min(8, Number(lineWidth) || 1));
    setMovingAverages((current) =>
      current.map((item) => (item.id === id ? { ...item, lineWidth: normalizedWidth } : item)),
    );
  }

  function handleRsiConfigChange(key, value) {
    setRsiConfig((current) => ({
      ...current,
      [key]: key === 'enabled' ? Boolean(value) : key === 'color' ? value : Math.max(1, Number(value) || 1),
    }));
  }

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

        <div className="chart-toolbar">
          <div className="chart-type-toggle" role="tablist" aria-label="차트 형태">
            <button
              type="button"
              className={chartType === 'line' ? 'active' : ''}
              onClick={() => setChartType('line')}
            >
              라인
            </button>
            <button
              type="button"
              className={chartType === 'candle' ? 'active' : ''}
              onClick={() => setChartType('candle')}
            >
              캔들
            </button>
          </div>

          <div ref={indicatorMenuRef} className="chart-indicator-menu">
            <button
              type="button"
              className={`chart-indicator-trigger ${isIndicatorMenuOpen ? 'active' : ''}`}
              onClick={() =>
                setIsIndicatorMenuOpen((current) => {
                  const nextOpen = !current;
                  if (!nextOpen) {
                    setSelectedIndicatorPanel(null);
                  }
                  return nextOpen;
                })
              }
              aria-expanded={isIndicatorMenuOpen}
            >
              보조지표
            </button>
            {isIndicatorMenuOpen ? (
              <div className="chart-indicator-popover">
                {selectedIndicatorPanel === 'moving-average' ? (
                  <div className="chart-indicator-section">
                    <div className="chart-indicator-section-head">
                      <button
                        type="button"
                        className="chart-indicator-back"
                        onClick={() => setSelectedIndicatorPanel(null)}
                      >
                        ← 보조지표
                      </button>
                      <strong>이동평균선</strong>
                      <span>지난 N일 동안 주가 평균값을 이은 선</span>
                    </div>

                    <div className="chart-ma-config-list">
                      {movingAverages.map((item, index) => (
                        <div key={item.id} className="chart-ma-config-row">
                          <span className="chart-ma-config-label">{`기간${index + 1}`}</span>
                          <label className="chart-ma-color-chip">
                            <input
                              type="color"
                              value={item.color}
                              onChange={(event) => handleMovingAverageColorChange(item.id, event.target.value)}
                              aria-label={`기간${index + 1} 색상`}
                            />
                            <span style={{ backgroundColor: item.color }} aria-hidden="true" />
                            <em>{`${item.lineWidth ?? 1}px`}</em>
                          </label>
                          <button type="button" className="chart-ma-source-chip">
                            종가
                          </button>
                          <input
                            type="text"
                            inputMode="numeric"
                            className="chart-ma-period-input"
                            value={item.period}
                            onChange={(event) => handleMovingAveragePeriodChange(item.id, event.target.value)}
                          />
                          <select
                            className="chart-ma-width-select"
                            value={item.lineWidth ?? 1}
                            onChange={(event) => handleMovingAverageWidthChange(item.id, event.target.value)}
                            aria-label={`기간${index + 1} 두께`}
                          >
                            <option value="1">1px</option>
                            <option value="2">2px</option>
                            <option value="3">3px</option>
                            <option value="4">4px</option>
                          </select>
                          {movingAverages.length > 1 ? (
                            <button
                              type="button"
                              className="chart-ma-remove"
                              onClick={() => handleRemoveMovingAverage(item.id)}
                              aria-label={`기간${index + 1} 삭제`}
                            >
                              ×
                            </button>
                          ) : (
                            <span className="chart-ma-remove-placeholder" aria-hidden="true" />
                          )}
                        </div>
                      ))}
                    </div>

                    <button type="button" className="chart-ma-add" onClick={handleAddMovingAverage}>
                      <span>+</span>
                      기간 추가
                    </button>
                  </div>
                ) : selectedIndicatorPanel === 'rsi' ? (
                  <div className="chart-indicator-section">
                    <div className="chart-indicator-section-head">
                      <button
                        type="button"
                        className="chart-indicator-back"
                        onClick={() => setSelectedIndicatorPanel(null)}
                      >
                        ← 보조지표
                      </button>
                      <strong>RSI</strong>
                      <span>최근 상승폭과 하락폭을 비교해 강도를 보여주는 지표</span>
                    </div>

                    <div className="chart-rsi-config">
                      <label className="chart-rsi-row">
                        <span>표시</span>
                        <button
                          type="button"
                          className={`chart-rsi-toggle ${rsiConfig.enabled ? 'enabled' : ''}`}
                          onClick={() => handleRsiConfigChange('enabled', !rsiConfig.enabled)}
                        >
                          {rsiConfig.enabled ? 'ON' : 'OFF'}
                        </button>
                      </label>
                      <label className="chart-rsi-row">
                        <span>기간</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="chart-rsi-input"
                          value={rsiConfig.period}
                          onChange={(event) => handleRsiConfigChange('period', event.target.value)}
                        />
                      </label>
                      <label className="chart-rsi-row">
                        <span>색상</span>
                        <label className="chart-ma-color-chip">
                          <input
                            type="color"
                            value={rsiConfig.color}
                            onChange={(event) => handleRsiConfigChange('color', event.target.value)}
                            aria-label="RSI 색상"
                          />
                          <span style={{ backgroundColor: rsiConfig.color }} aria-hidden="true" />
                          <em>{`${rsiConfig.lineWidth}px`}</em>
                        </label>
                      </label>
                      <label className="chart-rsi-row">
                        <span>두께</span>
                        <select
                          className="chart-rsi-input"
                          value={rsiConfig.lineWidth}
                          onChange={(event) => handleRsiConfigChange('lineWidth', event.target.value)}
                        >
                          <option value="1">1px</option>
                          <option value="2">2px</option>
                          <option value="3">3px</option>
                          <option value="4">4px</option>
                        </select>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="chart-indicator-list">
                    <button
                      type="button"
                      className="chart-indicator-list-item"
                      onClick={() => setSelectedIndicatorPanel('moving-average')}
                    >
                      <div>
                        <strong>이동평균선</strong>
                        <span>주가 평균선을 설정합니다</span>
                      </div>
                      <em>›</em>
                    </button>
                    <button
                      type="button"
                      className="chart-indicator-list-item"
                      onClick={() => setSelectedIndicatorPanel('rsi')}
                    >
                      <div>
                        <strong>RSI</strong>
                        <span>상대강도지수를 표시합니다</span>
                      </div>
                      <em>›</em>
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        ref={frameRef}
        className={`chart-frame ${hasRsiPane ? 'has-rsi-pane' : ''}`}
        style={{
          '--rsi-scale-top-margin': `${RSI_SCALE_MARGIN_TOP * 100}%`,
          '--rsi-scale-bottom-margin': `${RSI_SCALE_MARGIN_BOTTOM * 100}%`,
        }}
      >
        {hasVolume ? <div className="chart-pane-divider volume" aria-hidden="true" /> : null}
        {hasRsiPane ? <div className="chart-pane-divider rsi" aria-hidden="true" /> : null}
        {hasRsiPane ? (
          <div className="chart-rsi-band" aria-hidden="true">
            <div className="chart-rsi-band-range" />
          </div>
        ) : null}
        <div ref={containerRef} className="lightweight-chart" />
        {chartType === 'candle' && candleInfo ? (
          <div className="chart-candle-ohlc">
            <span>{`시 ${new Intl.NumberFormat('ko-KR').format(Math.round(candleInfo.open))}`}</span>
            <span>
              {`고 ${new Intl.NumberFormat('ko-KR').format(Math.round(candleInfo.high))} `}
              <em className={candleInfo.high >= candleInfo.open ? 'up' : 'down'}>
                {`(${formatPercentFromOpen(candleInfo.open, candleInfo.high)})`}
              </em>
            </span>
            <span>
              {`저 ${new Intl.NumberFormat('ko-KR').format(Math.round(candleInfo.low))} `}
              <em className={candleInfo.low >= candleInfo.open ? 'up' : 'down'}>
                {`(${formatPercentFromOpen(candleInfo.open, candleInfo.low)})`}
              </em>
            </span>
            <span>
              {`종 ${new Intl.NumberFormat('ko-KR').format(Math.round(candleInfo.close))} `}
              <em className={candleInfo.close >= candleInfo.open ? 'up' : 'down'}>
                {`(${formatPercentFromOpen(candleInfo.open, candleInfo.close)})`}
              </em>
            </span>
          </div>
        ) : null}
        {hasVolume ? (
          <div className="chart-volume-header">
            <span className="chart-volume-label">거래량</span>
            {hoveredVolume !== null ? (
              <span className="chart-volume-value">{new Intl.NumberFormat('ko-KR').format(Math.round(hoveredVolume))}</span>
            ) : null}
          </div>
        ) : null}
        {hasRsiPane ? (
          <div className="chart-rsi-header">
            <span className="chart-rsi-label">{`RSI (${rsiConfig.period})`}</span>
            {hoveredRsi !== null ? <span className="chart-rsi-value">{hoveredRsi.toFixed(2)}</span> : null}
          </div>
        ) : null}

        {isLoading ? <div className="chart-status">실시간 시세를 불러오는 중입니다.</div> : null}
        {statusMessage && statusTone === 'error' ? (
          <div className={`chart-status ${statusTone}`}>{statusMessage}</div>
        ) : null}
      </div>

      {!hideFooterText ? (
        <>
          <p className="chart-attribution">
            Market data rendered with TradingView Lightweight Charts.
            <a href="https://www.tradingview.com" target="_blank" rel="noreferrer">
              TradingView
            </a>
          </p>

          {statusMessage && statusTone === 'info' ? <p className="chart-note">{statusMessage}</p> : null}
        </>
      ) : null}

      <div className="trade-bar">
        <div className="trade-bar-meta">
          <div className="trade-bar-meta-headings">
            <span>현재 거래 기준가</span>
            <span>금일 범위</span>
            <span>수익률</span>
          </div>
          <div className="trade-bar-meta-row">
            <strong>
              {new Intl.NumberFormat('ko-KR', {
                style: 'currency',
                currency: 'KRW',
                maximumFractionDigits: 0,
              }).format(currentPrice)}
            </strong>
            <strong>
              {`${new Intl.NumberFormat('ko-KR', {
                style: 'currency',
                currency: 'KRW',
                maximumFractionDigits: 0,
              }).format(currentLowPrice ?? currentPrice)} - ${new Intl.NumberFormat('ko-KR', {
                style: 'currency',
                currency: 'KRW',
                maximumFractionDigits: 0,
              }).format(currentHighPrice ?? currentPrice)}`}
            </strong>
            <em className={`trade-return-rate ${returnRateClass}`}>
              {`${currentReturnRate >= 0 ? '+' : ''}${currentReturnRate.toFixed(2)}%`}
            </em>
          </div>
        </div>

        <div className="trade-bar-actions">
          {onAuxClick ? (
            <button type="button" className="trade-button item" onClick={onAuxClick} disabled={disableAuxButton}>
              {auxButtonLabel || '아이템'}
            </button>
          ) : null}
          <button type="button" className="trade-button sell" onClick={onSellClick} disabled={disableSell}>
            매도
          </button>
          <button type="button" className="trade-button buy" onClick={onBuyClick} disabled={disableBuy}>
            매수
          </button>
        </div>
      </div>

      {!hideFooterText && tradeFeedback ? <p className="trade-feedback">{tradeFeedback}</p> : null}
    </div>
  );
}
