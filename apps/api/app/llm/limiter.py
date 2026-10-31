"""
Async rate limiter for LLM provider calls.

Two constraints enforced:
1. Concurrency semaphore: at most `max_concurrent` extractions run at once.
2. Token-bucket RPM limiter: at most `max_rpm` requests per minute,
   implemented as a minimum spacing of (60 / max_rpm) seconds between calls.

The clock and sleep function are injectable for deterministic unit tests.
"""

from __future__ import annotations

import asyncio
import time
from collections.abc import Callable, Coroutine
from typing import Any


class ExtractionLimiter:
    """
    Async limiter combining a concurrency semaphore and a token-bucket RPM cap.

    Parameters
    ----------
    max_concurrent:
        Maximum number of simultaneous in-flight extractions (default 2).
    max_rpm:
        Maximum API calls per minute (default 10).
    clock:
        Callable returning the current time in seconds (default time.monotonic).
        Inject a fake clock in tests.
    sleep:
        Async callable accepting seconds to sleep (default asyncio.sleep).
        Inject a fake sleep in tests.
    """

    def __init__(
        self,
        max_concurrent: int = 2,
        max_rpm: int = 10,
        *,
        clock: Callable[[], float] | None = None,
        sleep: Callable[[float], Coroutine[Any, Any, None]] | None = None,
    ) -> None:
        self._semaphore = asyncio.Semaphore(max_concurrent)
        self._min_interval = 60.0 / max(1, max_rpm)
        self._last_call_time: float = -float("inf")
        self._bucket_lock = asyncio.Lock()
        self._clock: Callable[[], float] = clock or time.monotonic
        self._sleep: Callable[[float], Coroutine[Any, Any, None]] = sleep or asyncio.sleep

    async def __aenter__(self) -> ExtractionLimiter:
        """Acquire the concurrency slot and enforce the RPM spacing."""
        await self._semaphore.acquire()
        await self._wait_for_token()
        return self

    async def __aexit__(self, *_: object) -> None:
        """Release the concurrency slot."""
        self._semaphore.release()

    async def _wait_for_token(self) -> None:
        """
        Enforce minimum spacing between requests.

        Uses a lock so that two coroutines racing to get a token both wait
        their fair share rather than both reading the same _last_call_time.
        """
        async with self._bucket_lock:
            now = self._clock()
            elapsed = now - self._last_call_time
            wait = self._min_interval - elapsed
            if wait > 0:
                await self._sleep(wait)
            self._last_call_time = self._clock()
