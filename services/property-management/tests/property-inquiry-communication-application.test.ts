import { describe, expect, it, vi } from "vitest";

import {
  InvalidPropertyInquiryCommunicationInputError,
  InvalidPropertyInquiryCommunicationListError,
  ListPropertyInquiryCommunications,
  PropertyForbiddenError,
  PropertyInquiryCommunication,
  PropertyInquiryCommunicationNotFoundError,
  RecordPropertyInquiryCommunication,
  type PropertyAuthority,
  type PropertyInquiryCommunicationRepository,
} from "../src/index.js";

const TENANT_ID =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const PROPERTY_ID =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const INQUIRY_ID =
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const COMMUNICATION_ID =
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const CORRELATION_ID =
  "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

const NOW = "2026-09-13T13:00:00.000Z";

function authority(
  grants: PropertyAuthority["grants"],
): PropertyAuthority {
  return {
    actorId: "commercial-1",
    authorityId: "commercial-1",
    grants,
    tenantIds: [TENANT_ID],
  };
}

function repository(
  overrides: Partial<PropertyInquiryCommunicationRepository> = {},
): PropertyInquiryCommunicationRepository {
  return {
    record: vi.fn(async () => "CREATED"),
    list: vi.fn(async () => ({
      items: [],
    })),
    ...overrides,
  };
}

describe("Property inquiry communication application", () => {
  it("records a manual communication from authenticated authority context", async () => {
    const repo = repository();

    const useCase =
      new RecordPropertyInquiryCommunication(
        repo,
        {
          generate: () => COMMUNICATION_ID,
        },
        {
          now: () => NOW,
        },
      );

    const result = await useCase.execute({
      authority: authority([
        "MANAGE_PROPERTY_INQUIRIES",
      ]),
      propertyId: PROPERTY_ID,
      inquiryId: INQUIRY_ID,
      channel: "PHONE",
      direction: "OUTBOUND",
      summary: "  Appel effectué au prospect  ",
      correlationId: CORRELATION_ID,
    });

    expect(result.values).toEqual({
      communicationId: COMMUNICATION_ID,
      tenantId: TENANT_ID,
      propertyId: PROPERTY_ID,
      inquiryId: INQUIRY_ID,
      channel: "PHONE",
      direction: "OUTBOUND",
      status: "RECORDED",
      summary: "Appel effectué au prospect",
      occurredAt: NOW,
      performedByActorId: "commercial-1",
      createdAt: NOW,
    });

    expect(repo.record).toHaveBeenCalledWith(
      result,
      {
        correlationId: CORRELATION_ID,
        actorId: "commercial-1",
      },
    );
  });

  it("preserves a valid backdated occurredAt", async () => {
    const repo = repository();

    const useCase =
      new RecordPropertyInquiryCommunication(
        repo,
        {
          generate: () => COMMUNICATION_ID,
        },
        {
          now: () => NOW,
        },
      );

    const result = await useCase.execute({
      authority: authority([
        "MANAGE_PROPERTY_INQUIRIES",
      ]),
      propertyId: PROPERTY_ID,
      inquiryId: INQUIRY_ID,
      channel: "SMS",
      direction: "INBOUND",
      occurredAt: "2026-09-13T12:45:00.000Z",
      correlationId: CORRELATION_ID,
    });

    expect(result.values.occurredAt)
      .toBe("2026-09-13T12:45:00.000Z");

    expect(result.values.createdAt)
      .toBe(NOW);

    expect(result.values.status)
      .toBe("RECORDED");
  });

  it("rejects an occurredAt later than creation time", async () => {
    const repo = repository();

    const useCase =
      new RecordPropertyInquiryCommunication(
        repo,
        {
          generate: () => COMMUNICATION_ID,
        },
        {
          now: () => NOW,
        },
      );

    await expect(
      useCase.execute({
        authority: authority([
          "MANAGE_PROPERTY_INQUIRIES",
        ]),
        propertyId: PROPERTY_ID,
        inquiryId: INQUIRY_ID,
        channel: "PHONE",
        direction: "OUTBOUND",
        occurredAt: "2026-09-13T14:00:00.000Z",
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toBeInstanceOf(
      InvalidPropertyInquiryCommunicationInputError,
    );

    expect(repo.record).not.toHaveBeenCalled();
  });

  it("requires MANAGE_PROPERTY_INQUIRIES to record", async () => {
    const repo = repository();

    const useCase =
      new RecordPropertyInquiryCommunication(
        repo,
        {
          generate: () => COMMUNICATION_ID,
        },
        {
          now: () => NOW,
        },
      );

    await expect(
      useCase.execute({
        authority: authority([
          "RETRIEVE_PROPERTY_INQUIRY",
        ]),
        propertyId: PROPERTY_ID,
        inquiryId: INQUIRY_ID,
        channel: "PHONE",
        direction: "OUTBOUND",
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toBeInstanceOf(
      PropertyForbiddenError,
    );

    expect(repo.record).not.toHaveBeenCalled();
  });

  it("maps a missing inquiry while recording to application not found", async () => {
    const repo = repository({
      record: vi.fn(
        async () => "INQUIRY_NOT_FOUND",
      ),
    });

    const useCase =
      new RecordPropertyInquiryCommunication(
        repo,
        {
          generate: () => COMMUNICATION_ID,
        },
        {
          now: () => NOW,
        },
      );

    await expect(
      useCase.execute({
        authority: authority([
          "MANAGE_PROPERTY_INQUIRIES",
        ]),
        propertyId: PROPERTY_ID,
        inquiryId: INQUIRY_ID,
        channel: "EMAIL",
        direction: "OUTBOUND",
        correlationId: CORRELATION_ID,
      }),
    ).rejects.toBeInstanceOf(
      PropertyInquiryCommunicationNotFoundError,
    );
  });

  it("lists communications with default pagination and read authorization", async () => {
    const item =
      PropertyInquiryCommunication.create({
        communicationId: COMMUNICATION_ID,
        tenantId: TENANT_ID,
        propertyId: PROPERTY_ID,
        inquiryId: INQUIRY_ID,
        channel: "PHONE",
        direction: "OUTBOUND",
        status: "RECORDED",
        occurredAt: NOW,
        performedByActorId: "commercial-1",
        createdAt: NOW,
      });

    const repo = repository({
      list: vi.fn(async () => ({
        items: [item],
      })),
    });

    const useCase =
      new ListPropertyInquiryCommunications(repo);

    const page = await useCase.execute({
      authority: authority([
        "RETRIEVE_PROPERTY_INQUIRY",
      ]),
      propertyId: PROPERTY_ID,
      inquiryId: INQUIRY_ID,
    });

    expect(page.items).toEqual([item]);

    expect(repo.list).toHaveBeenCalledWith(
      TENANT_ID,
      PROPERTY_ID,
      INQUIRY_ID,
      20,
      undefined,
    );
  });

  it("passes the communication cursor unchanged", async () => {
    const repo = repository();

    const useCase =
      new ListPropertyInquiryCommunications(repo);

    const cursor = {
      occurredAt: "2026-09-13T12:00:00.000Z",
      communicationId: COMMUNICATION_ID,
    };

    await useCase.execute({
      authority: authority([
        "RETRIEVE_PROPERTY_INQUIRY",
      ]),
      propertyId: PROPERTY_ID,
      inquiryId: INQUIRY_ID,
      limit: 100,
      cursor,
    });

    expect(repo.list).toHaveBeenCalledWith(
      TENANT_ID,
      PROPERTY_ID,
      INQUIRY_ID,
      100,
      cursor,
    );
  });

  it.each([
    0,
    101,
    1.5,
  ])(
    "rejects invalid communication list limit %s",
    async (limit) => {
      const repo = repository();

      const useCase =
        new ListPropertyInquiryCommunications(repo);

      await expect(
        useCase.execute({
          authority: authority([
            "RETRIEVE_PROPERTY_INQUIRY",
          ]),
          propertyId: PROPERTY_ID,
          inquiryId: INQUIRY_ID,
          limit,
        }),
      ).rejects.toBeInstanceOf(
        InvalidPropertyInquiryCommunicationListError,
      );

      expect(repo.list).not.toHaveBeenCalled();
    },
  );

  it("requires RETRIEVE_PROPERTY_INQUIRY to list", async () => {
    const repo = repository();

    const useCase =
      new ListPropertyInquiryCommunications(repo);

    await expect(
      useCase.execute({
        authority: authority([
          "MANAGE_PROPERTY_INQUIRIES",
        ]),
        propertyId: PROPERTY_ID,
        inquiryId: INQUIRY_ID,
      }),
    ).rejects.toBeInstanceOf(
      PropertyForbiddenError,
    );

    expect(repo.list).not.toHaveBeenCalled();
  });

  it("maps an inaccessible inquiry while listing to application not found", async () => {
    const repo = repository({
      list: vi.fn(async () => undefined),
    });

    const useCase =
      new ListPropertyInquiryCommunications(repo);

    await expect(
      useCase.execute({
        authority: authority([
          "RETRIEVE_PROPERTY_INQUIRY",
        ]),
        propertyId: PROPERTY_ID,
        inquiryId: INQUIRY_ID,
      }),
    ).rejects.toBeInstanceOf(
      PropertyInquiryCommunicationNotFoundError,
    );
  });
});