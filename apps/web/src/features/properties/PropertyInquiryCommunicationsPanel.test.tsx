import {
  fireEvent,
  render,
  screen,
  waitFor,
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
  PropertyInquiryCommunicationsPanel,
} from "./PropertyInquiryCommunicationsPanel.js";

const PROPERTY_ID =
  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const INQUIRY_ID =
  "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

const COMMUNICATION_ID =
  "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const communication = {
  communicationId: COMMUNICATION_ID,
  propertyId: PROPERTY_ID,
  inquiryId: INQUIRY_ID,
  channel: "PHONE" as const,
  direction: "OUTBOUND" as const,
  status: "RECORDED" as const,
  summary: "Client joint, visite à confirmer.",
  occurredAt: "2026-09-13T12:00:00.000Z",
  performedByActorId: "agent@example.test",
  createdAt: "2026-09-13T12:05:00.000Z",
};

function client(
  overrides: Partial<PropertyInquiryApi> = {},
): PropertyInquiryApi {
  return {
    listPropertyInquiryCommunications:
      vi.fn(async () => ({
        items: [communication],
        pageInfo: {
          hasNextPage: false,
          nextCursor: null,
        },
      })),
    recordPropertyInquiryCommunication:
      vi.fn(async () => communication),

    listPropertyInquiries: vi.fn(),
    acknowledgePropertyInquiry: vi.fn(),
    closePropertyInquiry: vi.fn(),
    retrieveInquiryViewing: vi.fn(),
    schedulePropertyViewing: vi.fn(),
    reschedulePropertyViewing: vi.fn(),
    completePropertyViewing: vi.fn(),
    cancelPropertyViewing: vi.fn(),
    retrievePropertyViewingOutcome: vi.fn(),
    createPropertyViewingOutcome: vi.fn(),
    proceedPropertyViewingOutcome: vi.fn(),
    declinePropertyViewingOutcome: vi.fn(),

    ...overrides,
  };
}

describe(
  "Property inquiry communications",
  () => {
    it(
      "affiche l’historique des échanges",
      async () => {
        render(
          <PropertyInquiryCommunicationsPanel
            propertyId={PROPERTY_ID}
            inquiryId={INQUIRY_ID}
            api={client()}
          />,
        );

        expect(
          await screen.findByText(
            "Client joint, visite à confirmer.",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "Appel · sortant",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "Par agent@example.test",
          ),
        ).toBeVisible();
      },
    );

    it(
      "enregistre un échange manuel",
      async () => {
        const api = client();

        render(
          <PropertyInquiryCommunicationsPanel
            propertyId={PROPERTY_ID}
            inquiryId={INQUIRY_ID}
            api={api}
          />,
        );

        await screen.findByText(
          "Client joint, visite à confirmer.",
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Enregistrer un échange",
            },
          ),
        );

        fireEvent.change(
          screen.getByLabelText("Canal"),
          {
            target: {
              value: "SMS",
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText("Sens"),
          {
            target: {
              value: "OUTBOUND",
            },
          },
        );

        fireEvent.change(
          screen.getByLabelText("Note"),
          {
            target: {
              value:
                "Créneau transmis par SMS.",
            },
          },
        );

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name: "Enregistrer",
            },
          ),
        );

        await waitFor(() =>
          expect(
            api.recordPropertyInquiryCommunication,
          ).toHaveBeenCalledWith(
            PROPERTY_ID,
            INQUIRY_ID,
            expect.objectContaining({
              channel: "SMS",
              direction: "OUTBOUND",
              summary:
                "Créneau transmis par SMS.",
            }),
          ),
        );

        expect(
          await screen.findByText(
            "Échange enregistré.",
          ),
        ).toBeVisible();
      },
    );

    it(
      "conserve l’historique en cas d’échec de chargement supplémentaire",
      async () => {
        const api = client({
          listPropertyInquiryCommunications:
            vi.fn()
              .mockResolvedValueOnce({
                items: [communication],
                pageInfo: {
                  hasNextPage: true,
                  nextCursor:
                    "opaque.cursor",
                },
              })
              .mockRejectedValueOnce(
                new Error("network"),
              ),
        });

        render(
          <PropertyInquiryCommunicationsPanel
            propertyId={PROPERTY_ID}
            inquiryId={INQUIRY_ID}
            api={api}
          />,
        );

        expect(
          await screen.findByText(
            "Client joint, visite à confirmer.",
          ),
        ).toBeVisible();

        fireEvent.click(
          screen.getByRole(
            "button",
            {
              name:
                "Afficher plus d’échanges",
            },
          ),
        );

        expect(
          await screen.findByText(
            "Impossible de charger les échanges. Réessayez.",
          ),
        ).toBeVisible();

        expect(
          screen.getByText(
            "Client joint, visite à confirmer.",
          ),
        ).toBeVisible();
      },
    );

    it(
      "affiche l’historique en lecture seule",
      async () => {
        const api = client();

        render(
          <PropertyInquiryCommunicationsPanel
            propertyId={PROPERTY_ID}
            inquiryId={INQUIRY_ID}
            api={api}
            readOnly
          />,
        );

        expect(
          await screen.findByText(
            "Client joint, visite à confirmer.",
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
          api.recordPropertyInquiryCommunication,
        ).not.toHaveBeenCalled();
      },
    );
  },
);