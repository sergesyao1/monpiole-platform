import { Pool } from "pg";
import type { PostgresConnectionConfiguration } from "./configuration.js";
import { toPoolConfiguration } from "./configuration.js";

export class PostgresPool {
  readonly #pool: Pool;
  #closed = false;

  public constructor(configuration: PostgresConnectionConfiguration) {
    this.#pool = new Pool(toPoolConfiguration(configuration));
  }

  public async readiness(): Promise<void> {
    this.assertOpen();
    await this.#pool.query("SELECT 1");
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;
    await this.#pool.end();
  }

  public infrastructurePool(): Pool {
    this.assertOpen();
    return this.#pool;
  }

  private assertOpen(): void {
    if (this.#closed) throw new Error("PostgreSQL pool is closed");
  }
}
