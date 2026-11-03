# Build the existing frontend without changing its UI.
FROM node:20-alpine AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt \
    && useradd --create-home --uid 10001 app \
    && mkdir -p /home/app/.azure \
    && chown -R app:app /home/app/.azure
COPY app/ app/
COPY scripts/ scripts/
COPY --from=frontend /frontend/dist ./frontend/dist
USER app
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=4)"
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]

# Local developer account login, isolated from the application's dependencies.
FROM runtime AS local
USER root
RUN python -m venv /opt/azure-cli \
    && /opt/azure-cli/bin/pip install --no-cache-dir 'azure-cli>=2.70,<3' \
    && ln -s /opt/azure-cli/bin/az /usr/local/bin/az
COPY requirements-dev.txt .
RUN pip install --no-cache-dir -r requirements-dev.txt
COPY tests/ tests/
USER app

# Default build remains the lean managed-identity image for Azure Container Apps.
FROM runtime AS production
