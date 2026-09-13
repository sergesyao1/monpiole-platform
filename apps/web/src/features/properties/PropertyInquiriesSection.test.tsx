import {
  render,
  screen,
} from "@testing-library/react";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

import type {
  PropertyInquiryApi,
} from "./property-api.js";
import {
  PropertyInquiriesSection,
} from "./PropertyInquiriesSection.js";

const PROPERTY_ID =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const INQUIRY_ID =
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

function inquiry(
  status: "NEW" | "ACKNOWLEDGED" | "CLOSED",
) {
  return {
    inquiryId: INQUIRY_ID,
    propertyId: PROPERTY_ID,
    contactName: "Koffi Jean",
    phoneNumber:
      "+225 07 00 00 00 00",
    email:
      "jean@example.test",
    message:
      "Je souhaite visiter samedi.",
    intent:
      "VIEWING_REQUEST" as const,
    preferredContactChannel:
      "SMS" as const,
    consentVersion: "v1",
    consentGivenAt:
      "2026-09-13T10:00:00.000Z",
    status,
    ...(status === "NEW"
      ? {}
      : {
          acknowledgedAt:
            "2026-09-13T10:05:00.000Z",
        }),
    ...(status === "CLOSED"
      ? {
          closedAt:
            "2026-09-13T11:00:00.000Z",
        }
      : {}),
    createdAt:
      "2026-09-13T10:00:00.000Z",
    updatedAt:
      "2026-09-13T10:00:00.000Z",
  };
}

function api(
  items: readonly any[] = [],
): PropertyInquiryApi {
  return {
    listPropertyInquiryCommunications:
      vi.fn(async () => ({
        items: [],
        pageInfo: {
          hasNextPage: false,
          nextCursor: null,
        },
      })),
    recordPropertyInquiryCommunication:
      vi.fn(),

    listPropertyInquiries:
      vi.fn(async () => ({
        items,
        pageInfo: {
          hasNextPage: false,
          nextCursor: null,
        },
      })),

    acknowledgePropertyInquiry:
      vi.fn(),
    closePropertyInquiry:
      vi.fn(),
    retrieveInquiryViewing:
      vi.fn(async () => ({
        viewing: null,
      })),
    schedulePropertyViewing:
      vi.fn(),
    reschedulePropertyViewing:
      vi.fn(),
    completePropertyViewing:
      vi.fn(),
    cancelPropertyViewing:
      vi.fn(),
    retrievePropertyViewingOutcome:
      vi.fn(),
    createPropertyViewingOutcome:
      vi.fn(),
    proceedPropertyViewingOutcome:
      vi.fn(),
    declinePropertyViewingOutcome:
      vi.fn(),
  };
}

describe(
  "Property inquiries management",
  () => {
    it(
      "shows the empty state",
      async () => {
        render(
          <PropertyInquiriesSection
            propertyId={PROPERTY_ID}
            api={api()}
          />,
        );

        expect(
          await screen.findByText(
            "Aucune demande",
          ),
        ).toBeVisible();
      },
    );

    it(
      "affiche les informations commerciales d’une nouvelle demande sans démarrer le suivi",
      async () => {
        const client = api([
          inquiry("NEW"),
        ]);

        render(
          <PropertyInquiriesSection
            propertyId={PROPERTY_ID}
            api={client}
          />,
        );

        expect(
          await screen.findByText(
            "Koffi Jean",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "Demande de visite",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "+225 07 00 00 00 00",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "jean@example.test",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            /Contact préféré/,
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "Demande à prendre en compte",
          ),
        ).toBeVisible();

        expect(
          screen.queryByRole(
            "region",
            {
              name:
                "Historique des échanges",
            },
          ),
        ).not.toBeInTheDocument();

        expect(
          client.listPropertyInquiryCommunications,
        ).not.toHaveBeenCalled();

        expect(
          screen.getByRole(
            "button",
            {
              name:
                "Prendre en compte",
            },
          ),
        ).toBeVisible();
      },
    );

    it(
      "autorise le suivi commercial après prise en compte",
      async () => {
        const client = api([
          inquiry("ACKNOWLEDGED"),
        ]);

        render(
          <PropertyInquiriesSection
            propertyId={PROPERTY_ID}
            api={client}
          />,
        );

        expect(
          await screen.findByRole(
            "region",
            {
              name:
                "Historique des échanges",
            },
          ),
        ).toBeVisible();

        expect(
          await screen.findByRole(
            "button",
            {
              name:
                "Enregistrer un échange",
            },
          ),
        ).toBeVisible();

        expect(
          client.listPropertyInquiryCommunications,
        ).toHaveBeenCalledWith(
          PROPERTY_ID,
          INQUIRY_ID,
          undefined,
        );

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Prendre en compte",
            },
          ),
        ).not.toBeInTheDocument();
      },
    );

    it(
      "conserve l’historique d’une demande clôturée en lecture seule",
      async () => {
        const client = api([
          inquiry("CLOSED"),
        ]);

        render(
          <PropertyInquiriesSection
            propertyId={PROPERTY_ID}
            api={client}
          />,
        );

        expect(
          await screen.findByRole(
            "region",
            {
              name:
                "Historique des échanges",
            },
          ),
        ).toBeVisible();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Enregistrer un échange",
            },
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name: "Clore",
            },
          ),
        ).not.toBeInTheDocument();

        expect(
          screen.queryByRole(
            "button",
            {
              name:
                "Prendre en compte",
            },
          ),
        ).not.toBeInTheDocument();

        expect(
          client.listPropertyInquiryCommunications,
        ).toHaveBeenCalledWith(
          PROPERTY_ID,
          INQUIRY_ID,
          undefined,
        );
      },
    );
  },
);