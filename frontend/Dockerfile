FROM node:24-alpine AS builder

# Install Rust toolchain + wasm-pack for WASM tokenizer build
RUN apk add --no-cache curl build-base && \
  curl https://sh.rustup.rs -sSf | sh -s -- -y --default-toolchain stable && \
  . "$HOME/.cargo/env" && \
  rustup target add wasm32-unknown-unknown && \
  curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

ENV PATH="/root/.cargo/bin:${PATH}"

WORKDIR /app

# Copy tokenizer Rust crate and build WASM first
COPY tokenizer /tokenizer
COPY frontend/package*.json ./
RUN npm install

# Build WASM tokenizer into the expected frontend source location
RUN wasm-pack build --target web --out-dir /app/src/wasm/tokenizer /tokenizer

COPY frontend/ .

# Build-time env vars baked into the Vite bundle
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_URL=""
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
