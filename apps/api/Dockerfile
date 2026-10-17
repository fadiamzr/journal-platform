FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8000

WORKDIR /app

# Create unprivileged user
RUN useradd -m -u 1000 appuser

# Install application dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy only application source code (no tests, no .env files)
COPY app/ ./app/

# Switch to non-root user
USER appuser

EXPOSE 8000

# Container healthcheck hitting /health via Python's standard library urllib
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD python -c "import os, urllib.request; urllib.request.urlopen(f'http://localhost:{os.environ.get(\"PORT\", 8000)}/health')" || exit 1

# Start Uvicorn ASGI server
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
