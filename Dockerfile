# Stage 1: Base image with Rust and Solana dependencies
FROM ubuntu:22.04 as builder

# Avoid prompts from apt
ENV DEBIAN_FRONTEND=noninteractive

# Install basic dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    build-essential \
    pkg-config \
    libudev-dev \
    libssl-dev \
    nodejs \
    npm \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
ENV PATH="/root/.cargo/bin:${PATH}"

# Install Solana CLI
RUN sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)" \
    && export PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Add Solana CLI to PATH permanently
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Generate Solana wallet and configure for devnet
RUN solana-keygen new --no-bip39-passphrase -o /root/.config/solana/id.json --force && \
    solana config set --url devnet && \
    solana config set --keypair /root/.config/solana/id.json

# Install Anchor CLI via AVM
RUN cargo install --git https://github.com/coral-xyz/anchor avm --force \
    && avm install latest \
    && avm use latest

# Install yarn
RUN npm install -g yarn

# Set working directory
WORKDIR /app

# Copy project files
COPY . .

# Build Anchor program
RUN cd anchor && \
    anchor build

# Install webapp dependencies and build
RUN yarn install
RUN yarn build

# Stage 2: Production image
FROM node:18-slim

WORKDIR /app

# Copy built files from builder
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/anchor/target ./anchor/target
# Copy the Solana wallet
COPY --from=builder /root/.config/solana/id.json /root/.config/solana/id.json

# Install production dependencies
RUN yarn install --production

# Install Solana CLI in production image
RUN sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)" 
ENV PATH="/root/.local/share/solana/install/active_release/bin:${PATH}"

# Expose the port the app runs on
EXPOSE 3000

# Copy scripts/check-wallet.js
COPY scripts/check-wallet.js ./scripts/check-wallet.js

# Copy startup script
COPY scripts/startup.js ./scripts/startup.js

# Start the application
CMD ["node", "scripts/startup.js"] 