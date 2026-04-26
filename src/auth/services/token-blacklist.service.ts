import { Injectable, Logger } from '@nestjs/common';

interface BlacklistEntry {
  expiresAt: number;
}

@Injectable()
export class TokenBlacklistService {
  private readonly logger = new Logger(TokenBlacklistService.name);
  private readonly entries = new Map<string, BlacklistEntry>();
  private readonly cleanupIntervalMs = 60_000;

  constructor() {
    setInterval(() => this.cleanup(), this.cleanupIntervalMs).unref?.();
  }

  add(jti: string, expiresAtSeconds: number): void {
    this.entries.set(jti, { expiresAt: expiresAtSeconds * 1000 });
  }

  has(jti: string): boolean {
    const entry = this.entries.get(jti);
    if (!entry) return false;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(jti);
      return false;
    }
    return true;
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.entries.entries()) {
      if (value.expiresAt <= now) this.entries.delete(key);
    }
  }
}
