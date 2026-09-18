import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  createMemoryRouter,
  RouterProvider,
} from "react-router";
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { applicationRoutes } from "../../app/routes.js";
import {
  SessionContext,
  type Session,
} from "../../auth/session.js";

const registrationId =
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const session: Session = {
  status: "authenticated",
  user: { name: "Plateforme MonPiole" },
  login: vi.fn(async () => undefined),
  logout: vi.fn(async () => undefined),
  getAccessToken: vi.fn(async () => "platform-token"),
};

const baseRegistration = {
  registrationId,
  status: "SUBMITTED",
  agencyLegalName: "Agence Ivoire Immobilier SARL",
  agencyTradeName: "Ivoire Immobilier",
  registrationNumber: "CI-ABJ-2026-B-12345",
  taxIdentifier: "CC-1234567-X",
  phone: "+2250102030405",
  email: "contact@ivoire-immobilier.example",
  website: "https://ivoire-immobilier.example",
  address: "Cocody Riviera",
  city: "Abidjan",
  countryCode: "CI",
  contactFirstName: "Awa",
  contactLastName: "Kone",
  contactEmail: "awa.kone@example.com",
  contactPhone: "+2250708091011",
  submittedAt: "2026-09-18T08:00:00.000Z",
  correlationId:
    "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  createdAt: "2026-09-18T08:00:00.000Z",
  updatedAt: "2026-09-18T08:00:00.000Z",
  documents: [
    {
      documentId:
        "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      documentType: "RCCM",
      originalFilename: "rccm.pdf",
      mimeType: "application/pdf",
      sizeBytes: 2048,
      checksumSha256:
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      createdAt: "2026-09-18T08:00:00.000Z",
    },
  ],
} as const;

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "content-type":
        status >= 400
          ? "application/problem+json"
          : "application/json",
    },
  });
}

interface ReviewFetchScenario {
  readonly initialRegistration: unknown;
  readonly actionPath?: string;
  readonly actionResponse?: unknown;
  readonly actionStatus?: number;
  readonly downloadPath?: string;
  readonly downloadStatus?: number;
}

function createReviewFetcher({
  initialRegistration,
  actionPath,
  actionResponse,
  actionStatus = 200,
  downloadPath,
  downloadStatus = 200,
}: ReviewFetchScenario) {
  return vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";

      if (
        url.endsWith(
          "/v1/authentication/authorization/platform-agency-registration-read",
        )
      ) {
        return new Response(null, { status: 204 });
      }

      if (
        url.endsWith(
          `/v1/platform/agency-registrations/${registrationId}`,
        ) &&
        method === "GET"
      ) {
        return jsonResponse(initialRegistration);
      }

      if (
        downloadPath &&
        url.endsWith(downloadPath) &&
        method === "GET"
      ) {
        if (downloadStatus === 403) {
          return new Response(null, { status: 403 });
        }

        return new Response(
          new Blob(["document"]),
          {
            status: downloadStatus,
            headers: {
              "content-type": "application/pdf",
            },
          },
        );
      }

      if (
        actionPath &&
        url.endsWith(actionPath) &&
        method === "POST"
      ) {
        if (actionStatus === 403) {
          return new Response(null, { status: 403 });
        }

        return jsonResponse(actionResponse, actionStatus);
      }

      throw new Error(
        `Unexpected request: ${method} ${url}`,
      );
    },
  );
}

function findRequest(
  fetcher: ReturnType<typeof createReviewFetcher>,
  path: string,
) {
  return fetcher.mock.calls.find(
    ([input]) => String(input).endsWith(path),
  );
}
function show(fetcher: typeof fetch) {
  vi.stubGlobal("fetch", fetcher);

  const router = createMemoryRouter(applicationRoutes, {
    initialEntries: [
      `/plateforme/inscriptions-agences/${registrationId}`,
    ],
  });

  render(
    <SessionContext.Provider value={session}>
      <RouterProvider router={router} />
    </SessionContext.Provider>,
  );

  return router;
}

describe("Revue d'une inscription agence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("affiche le dossier soumis et permet de commencer la revue", async () => {
    const underReview = {
      ...baseRegistration,
      status: "UNDER_REVIEW",
      reviewStartedAt: "2026-09-18T09:00:00.000Z",
      reviewedByIdentityId:
        "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      updatedAt: "2026-09-18T09:00:00.000Z",
    };

    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/review`;

    const fetcher = createReviewFetcher({
      initialRegistration: baseRegistration,
      actionPath,
      actionResponse: underReview,
    });

    show(fetcher as typeof fetch);

    expect(
      await screen.findByRole("heading", {
        name: "Ivoire Immobilier",
      }),
    ).toBeVisible();

    expect(screen.getByText("À examiner")).toBeVisible();
    expect(
      screen.getByText("Agence Ivoire Immobilier SARL"),
    ).toBeVisible();
    expect(screen.getByText("rccm.pdf")).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Commencer la revue",
      }),
    );

    expect(
      await screen.findByText("En cours de revue"),
    ).toBeVisible();

    expect(
      screen.getByRole("button", { name: "Approuver" }),
    ).toBeVisible();

    expect(
      screen.getByRole("button", { name: "Rejeter" }),
    ).toBeVisible();

    const request = await waitFor(() => {
      const matched = findRequest(fetcher, actionPath);
      expect(matched).toBeDefined();
      return matched;
    });

    expect(
      (request?.[1] as RequestInit | undefined)?.method,
    ).toBe("POST");
  });

  it("approuve un dossier en cours de revue après confirmation", async () => {
    const underReview = {
      ...baseRegistration,
      status: "UNDER_REVIEW",
      reviewStartedAt: "2026-09-18T09:00:00.000Z",
    };

    const approved = {
      ...underReview,
      status: "APPROVED",
      approvedAt: "2026-09-18T09:30:00.000Z",
      approvalProvisioningStartedAt:
        "2026-09-18T09:30:00.000Z",
      updatedAt: "2026-09-18T09:30:00.000Z",
    };

    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/approve`;

    const fetcher = createReviewFetcher({
      initialRegistration: underReview,
      actionPath,
      actionResponse: approved,
    });

    const confirmation = vi
      .spyOn(window, "confirm")
      .mockReturnValue(true);

    show(fetcher as typeof fetch);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Approuver",
      }),
    );

    expect(confirmation).toHaveBeenCalledOnce();

    expect(
      await screen.findByText("Approuvée"),
    ).toBeVisible();

    expect(
      screen.getByText(
        "L'inscription agence a été approuvée.",
      ),
    ).toBeVisible();

    expect(
      screen.queryByRole("button", { name: "Rejeter" }),
    ).not.toBeInTheDocument();

    const request = findRequest(fetcher, actionPath);

    expect(request).toBeDefined();
    expect(
      (request?.[1] as RequestInit | undefined)?.method,
    ).toBe("POST");
  });

  it("rejette un dossier avec le motif canonique", async () => {
    const underReview = {
      ...baseRegistration,
      status: "UNDER_REVIEW",
      reviewStartedAt: "2026-09-18T09:00:00.000Z",
    };

    const rejected = {
      ...underReview,
      status: "REJECTED",
      rejectedAt: "2026-09-18T09:45:00.000Z",
      rejectionReason: "Document RCCM illisible.",
      updatedAt: "2026-09-18T09:45:00.000Z",
    };

    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/reject`;

    const fetcher = createReviewFetcher({
      initialRegistration: underReview,
      actionPath,
      actionResponse: rejected,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    show(fetcher as typeof fetch);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Rejeter",
      }),
    );

    const reason = screen.getByLabelText("Motif du rejet");

    fireEvent.change(reason, {
      target: {
        value: "  Document RCCM illisible.  ",
      },
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmer le rejet",
      }),
    );

    expect(
      await screen.findByText("Rejetée"),
    ).toBeVisible();

    expect(
      screen.getByText("Document RCCM illisible."),
    ).toBeVisible();

    const requestCall = await waitFor(() => {
      const matched = findRequest(fetcher, actionPath);
      expect(matched).toBeDefined();
      return matched;
    });

    const request =
      requestCall?.[1] as RequestInit | undefined;

    expect(request?.method).toBe("POST");

    expect(JSON.parse(String(request?.body))).toEqual({
      rejectionReason: "Document RCCM illisible.",
    });
  });

  it("affiche un refus explicite lorsque la revue est interdite", async () => {
    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/review`;

    const fetcher = createReviewFetcher({
      initialRegistration: baseRegistration,
      actionPath,
      actionStatus: 403,
    });

    show(fetcher as typeof fetch);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Commencer la revue",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Vous n’êtes pas autorisé à commencer la revue de cette inscription agence.",
    );

    expect(findRequest(fetcher, actionPath)).toBeDefined();
  });

  it("affiche un refus explicite lorsque l'approbation est interdite", async () => {
    const underReview = {
      ...baseRegistration,
      status: "UNDER_REVIEW",
      reviewStartedAt: "2026-09-18T09:00:00.000Z",
    };

    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/approve`;

    const fetcher = createReviewFetcher({
      initialRegistration: underReview,
      actionPath,
      actionStatus: 403,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    show(fetcher as typeof fetch);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Approuver",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Vous n’êtes pas autorisé à prendre une décision sur cette inscription agence.",
    );

    expect(findRequest(fetcher, actionPath)).toBeDefined();
  });

  it("affiche un refus explicite lorsque le rejet est interdit", async () => {
    const underReview = {
      ...baseRegistration,
      status: "UNDER_REVIEW",
      reviewStartedAt: "2026-09-18T09:00:00.000Z",
    };

    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/reject`;

    const fetcher = createReviewFetcher({
      initialRegistration: underReview,
      actionPath,
      actionStatus: 403,
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    show(fetcher as typeof fetch);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Rejeter",
      }),
    );

    fireEvent.change(
      screen.getByLabelText("Motif du rejet"),
      {
        target: {
          value: "Document RCCM illisible.",
        },
      },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Confirmer le rejet",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Vous n’êtes pas autorisé à prendre une décision sur cette inscription agence.",
    );

    expect(findRequest(fetcher, actionPath)).toBeDefined();
  });
  it("affiche un refus explicite lorsque le téléchargement d'un justificatif est interdit", async () => {
    const documentId =
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    const downloadPath =
      `/v1/platform/agency-registrations/${registrationId}/documents/${documentId}/content`;

    const fetcher = createReviewFetcher({
      initialRegistration: baseRegistration,
      downloadPath,
      downloadStatus: 403,
    });

    show(fetcher as typeof fetch);

    await screen.findByRole("heading", {
      name: "Ivoire Immobilier",
    });

    fireEvent.click(
      screen.getByRole("button", {
        name: "Télécharger",
      }),
    );

    expect(
      await screen.findByRole("alert"),
    ).toHaveTextContent(
      "Vous n’êtes pas autorisé à télécharger ce justificatif.",
    );

    expect(findRequest(fetcher, downloadPath)).toBeDefined();
  });
  it("n'envoie pas l'approbation lorsque la confirmation est annulée", async () => {
    const underReview = {
      ...baseRegistration,
      status: "UNDER_REVIEW",
      reviewStartedAt: "2026-09-18T09:00:00.000Z",
    };

    const actionPath =
      `/v1/platform/agency-registrations/${registrationId}/approve`;

    const fetcher = createReviewFetcher({
      initialRegistration: underReview,
    });

    vi.spyOn(window, "confirm").mockReturnValue(false);

    show(fetcher as typeof fetch);

    fireEvent.click(
      await screen.findByRole("button", {
        name: "Approuver",
      }),
    );

    expect(findRequest(fetcher, actionPath)).toBeUndefined();
    expect(screen.getByText("En cours de revue")).toBeVisible();
  });
});