# Playwright + Chromium need a container image — Chromium's binary size doesn't fit
# a normal zip Lambda deployment, and the standard playwright/mcr.microsoft.com image
# lacks the Lambda Runtime Interface Client, so we build on the AWS base instead.
#
# Build context is `services/` (the CDK stack points DockerImageCode at that
# directory with this Dockerfile's relative path) so it can also pull in `shared/`.
FROM public.ecr.aws/lambda/python:3.12

RUN dnf install -y \
    nss nspr atk at-spi2-atk at-spi2-core cups-libs libdrm libxkbcommon \
    libX11 libXcomposite libXcursor libXdamage libXext libXfixes libXi \
    libXrandr libXScrnSaver libXtst libxshmfence mesa-libgbm \
    pango cairo alsa-lib dbus-libs liberation-fonts \
    && dnf clean all

# Lambda runs the container as a different user than the one that builds the
# image, so Playwright's default install path (~/.cache/ms-playwright, which
# resolves differently per-user) won't be found at runtime unless pinned.
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright

COPY ingest/browser_adapter/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN python -m playwright install chromium

COPY ingest/browser_adapter/handler.py ${LAMBDA_TASK_ROOT}/
COPY shared ${LAMBDA_TASK_ROOT}/shared

CMD ["handler.lambda_handler"]
