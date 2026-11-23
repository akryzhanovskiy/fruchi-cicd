import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    """Sliding-window limit per client IP, kept in process memory.

    Good enough against accidental double submits and naive bots; with several API
    replicas each pod counts separately.
    """

    def __init__(self, limit: int, window_seconds: float):
        self.limit = limit
        self.window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        # nginx in front sets X-Real-IP; fall back to the socket peer for direct calls.
        key = request.headers.get("x-real-ip") or (request.client.host if request.client else "")
        now = time.monotonic()
        hits = self._hits[key]
        while hits and now - hits[0] > self.window:
            hits.popleft()
        if len(hits) >= self.limit:
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS,
                "Забагато спроб. Спробуйте за кілька хвилин.",
            )
        hits.append(now)

    def reset(self) -> None:
        self._hits.clear()
