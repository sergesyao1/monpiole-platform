export class AgencyRegistrationNumberConflictError extends Error {
  readonly code = "AGENCY_REGISTRATION_NUMBER_CONFLICT";

  constructor() {
    super("An agency registration with this registration number already exists");
  }
}

export class AgencyDocumentStorageKeyConflictError extends Error {
  readonly code = "AGENCY_DOCUMENT_STORAGE_KEY_CONFLICT";

  constructor() {
    super("An agency registration document with this storage key already exists");
  }
}
