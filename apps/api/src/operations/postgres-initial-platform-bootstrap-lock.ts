interface AdvisoryLockClient {
  query(text: string, values?: unknown[]): Promise<unknown>;
  release(): void;
}

interface AdvisoryLockPool {
  connect(): Promise<AdvisoryLockClient>;
}

const LOCK_NAME = "monpiole:initial-platform-bootstrap:v1";

export class PostgresInitialPlatformBootstrapLock {
  constructor(private readonly pool: AdvisoryLockPool) {}

  async execute<Result>(operation: () => Promise<Result>): Promise<Result> {
    const client = await this.pool.connect();
    await client.query("SELECT pg_advisory_lock(hashtextextended($1, 0))", [LOCK_NAME]);
    try {
      return await operation();
    } finally {
      await client.query("SELECT pg_advisory_unlock(hashtextextended($1, 0))", [LOCK_NAME]);
      client.release();
    }
  }
}
