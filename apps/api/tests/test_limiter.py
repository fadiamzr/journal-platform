"""
Tests for ExtractionLimiter — concurrency cap and RPM spacing.
Uses injectable fake clock and sleep for deterministic testing.
"""

from __future__ import annotations

import asyncio

import pytest

from app.llm.limiter import ExtractionLimiter

# ---------------------------------------------------------------------------
# Fake clock/sleep infrastructure
# ---------------------------------------------------------------------------


class FakeClock:
    """Monotonic fake clock where sleep advances the time."""

    def __init__(self) -> None:
        self._time: float = 0.0
        self._sleep_log: list[float] = []

    def __call__(self) -> float:
        return self._time

    async def sleep(self, seconds: float) -> None:
        self._sleep_log.append(seconds)
        self._time += seconds

    @property
    def sleep_log(self) -> list[float]:
        return self._sleep_log

    @property
    def now(self) -> float:
        return self._time


# ---------------------------------------------------------------------------
# RPM spacing tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_rpm_spacing_enforced():
    """With max_rpm=6, interval is 10s. Three calls should have ~20s of sleep."""
    clock = FakeClock()
    limiter = ExtractionLimiter(
        max_concurrent=10,
        max_rpm=6,
        clock=clock,
        sleep=clock.sleep,
    )

    call_times: list[float] = []

    async def record():
        async with limiter:
            call_times.append(clock.now)

    await record()
    await record()
    await record()

    # First call: no wait (clock starts at 0, no previous call)
    # Second call should have waited ~10s
    # Third call should have waited ~10s more
    assert len(call_times) == 3
    assert call_times[0] == pytest.approx(0.0, abs=0.1)
    assert call_times[1] >= 10.0 - 0.5
    assert call_times[2] >= 20.0 - 0.5


@pytest.mark.asyncio
async def test_rpm_no_sleep_when_enough_time_passed():
    """If enough time has passed, no sleep should occur."""
    clock = FakeClock()
    clock._time = 100.0  # start well past the interval

    limiter = ExtractionLimiter(
        max_concurrent=10,
        max_rpm=60,  # 1 req/sec interval
        clock=clock,
        sleep=clock.sleep,
    )
    # Simulate that last call was a long time ago
    limiter._last_call_time = 0.0  # 100 seconds ago

    async with limiter:
        pass  # should not sleep

    assert clock.sleep_log == [] or sum(clock.sleep_log) == pytest.approx(0.0, abs=0.01)


# ---------------------------------------------------------------------------
# Concurrency cap tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_concurrency_cap_at_2():
    """At most 2 tasks should run simultaneously."""
    clock = FakeClock()
    limiter = ExtractionLimiter(
        max_concurrent=2,
        max_rpm=600,  # effectively no RPM limit
        clock=clock,
        sleep=clock.sleep,
    )

    max_concurrent_seen = [0]
    currently_running = [0]
    lock = asyncio.Lock()

    async def task():
        async with limiter:
            async with lock:
                currently_running[0] += 1
                if currently_running[0] > max_concurrent_seen[0]:
                    max_concurrent_seen[0] = currently_running[0]
            await asyncio.sleep(0)  # yield to allow other tasks to run
            async with lock:
                currently_running[0] -= 1

    await asyncio.gather(*[task() for _ in range(6)])

    # Should never exceed 2 concurrent
    assert max_concurrent_seen[0] <= 2


@pytest.mark.asyncio
async def test_concurrency_all_tasks_complete():
    """All tasks should complete even under concurrency cap."""
    clock = FakeClock()
    limiter = ExtractionLimiter(
        max_concurrent=2,
        max_rpm=600,
        clock=clock,
        sleep=clock.sleep,
    )

    completed = [0]

    async def task():
        async with limiter:
            await asyncio.sleep(0)
            completed[0] += 1

    await asyncio.gather(*[task() for _ in range(5)])
    assert completed[0] == 5


@pytest.mark.asyncio
async def test_limiter_aenter_aexit_protocol():
    """ExtractionLimiter context manager protocol works correctly."""
    clock = FakeClock()
    limiter = ExtractionLimiter(
        max_concurrent=5,
        max_rpm=600,
        clock=clock,
        sleep=clock.sleep,
    )
    async with limiter as lim:
        assert lim is limiter
