export interface AgencyDocumentContent {
  readonly content: Uint8Array;
}

export interface StoreAgencyDocumentInput {
  readonly storageKey: string;
  readonly content: Uint8Array;
}

export interface AgencyDocumentStorage {
  store(
    input: StoreAgencyDocumentInput,
  ): Promise<void>;

  retrieve(
    storageKey: string,
  ): Promise<AgencyDocumentContent | undefined>;

  delete(
    storageKey: string,
  ): Promise<void>;
}