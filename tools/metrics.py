"""Minimal in-process metrics for workers and the backend.

Expose via GET /metrics. Thread-safe; keeps a rolling window of durations.
"""
from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any


class Metrics:
    def __init__(self, max_samples: int = 256) -> None:
        self._mu = threading.Lock()
        self._durations: dict[str, list[float]] = defaultdict(list)
        self._counters: dict[str, int] = defaultdict(int)
        self._gauges: dict[str, Any] = {}
        self._max_samples = max_samples

    def observe(self, name: str, seconds: float) -> None:
        with self._mu:
            bucket = self._durations[name]
            bucket.append(float(seconds))
            if len(bucket) > self._max_samples:
                del bucket[: len(bucket) - self._max_samples]

    def count(self, name: str, n: int = 1) -> None:
        with self._mu:
            self._counters[name] += n

    def set_gauge(self, name: str, value: Any) -> None:
        with self._mu:
            self._gauges[name] = value

    def timed(self, name: str):
        """Context manager that observes wall time for a block."""
        metrics = self

        class _Timer:
            def __enter__(self_inner):
                self_inner._t0 = time.perf_counter()
                return self_inner

            def __exit__(self_inner, *exc):
                metrics.observe(name, time.perf_counter() - self_inner._t0)
                return False

        return _Timer()

    def snapshot(self) -> dict[str, Any]:
        with self._mu:
            def pct(xs: list[float], p: float) -> float:
                if not xs:
                    return 0.0
                ordered = sorted(xs)
                idx = min(len(ordered) - 1, max(0, int(len(ordered) * p)))
                return round(ordered[idx], 4)

            return {
                "durations": {
                    key: {
                        "n": len(values),
                        "p50": pct(values, 0.5),
                        "p95": pct(values, 0.95),
                        "last": round(values[-1], 4) if values else 0.0,
                    }
                    for key, values in self._durations.items()
                },
                "counters": dict(self._counters),
                "gauges": dict(self._gauges),
            }


metrics = Metrics()
