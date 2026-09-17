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
export class AgencyRegistrationDocumentUploadDuplicateError extends Error {
  readonly code = "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_DUPLICATE";

  constructor() {
    super("The same agency registration document upload cannot be used more than once");
  }
}

export class AgencyRegistrationDocumentUploadNotFoundError extends Error {
  readonly code = "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_NOT_FOUND";

  constructor() {
    super("An agency registration document upload was not found");
  }
}

export class AgencyRegistrationDocumentUploadConsumedError extends Error {
  readonly code = "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_CONSUMED";

  constructor() {
    super("An agency registration document upload has already been consumed");
  }
}

export class AgencyRegistrationDocumentUploadExpiredError extends Error {
  readonly code = "AGENCY_REGISTRATION_DOCUMENT_UPLOAD_EXPIRED";

  constructor() {
    super("An agency registration document upload has expired");
  }
}
