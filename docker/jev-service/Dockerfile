FROM ghcr.io/ggml-org/llama.cpp:server-cuda

WORKDIR /app

# Install build tools, compiler and dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    nlohmann-json3-dev \
    python3-pip \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Compile jev-score with the prebuilt CUDA libraries from /app
COPY docker/jev-service/llama-include /tmp/llama-include
COPY docker/jev-service/jev_score.cpp /tmp/jev_score.cpp
RUN mkdir -p /app/bin && \
    c++ -std=c++17 -O3 -Wall \
    -I/tmp/llama-include/include \
    -I/tmp/llama-include/ggml-include \
    -I/tmp/llama-include/vendor \
    /tmp/jev_score.cpp -o /app/bin/jev-score \
    -L/app -lllama -lggml -lggml-base \
    -Wl,-rpath,/app && \
    rm -rf /tmp/llama-include /tmp/jev_score.cpp

# Install python requirements
COPY docker/jev-service/requirements.txt /app/requirements.txt
RUN pip3 install --no-cache-dir --break-system-packages -r /app/requirements.txt

COPY docker/jev-service/server.py /app/server.py

ENV LD_LIBRARY_PATH="/app:${LD_LIBRARY_PATH}"
ENV JEV_MODEL_DIR="/models/jev-0.8b"
ENV JEV_GPU_LAYERS="99"

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8001/health || exit 1

ENTRYPOINT []
CMD ["python3", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
