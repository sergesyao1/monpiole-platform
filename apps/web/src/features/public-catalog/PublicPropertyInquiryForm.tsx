import { type FormEvent, useRef, useState } from "react";
import { ApiProblem } from "../../infrastructure/http/problem-details.js";
import { Alert, Button, Field } from "../../ui/index.js";
import type {
  PublicInquiryIntent,
  PublicInquiryPreferredContactChannel,
  PublicPropertyApi,
} from "./public-property-api.js";

export function PublicPropertyInquiryForm({
  propertyId,
  api,
  intent,
}: Readonly<{
  propertyId: string;
  api: PublicPropertyApi;
  intent: PublicInquiryIntent;
}>) {
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [state, setState] = useState<
    "idle" | "saving" | "success" | "unavailable" | "error"
  >("idle");
  const form = useRef<HTMLFormElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state === "saving") return;

    const data = new FormData(event.currentTarget);

    const email = value(data, "email");
    const phoneNumber = value(data, "phoneNumber");
    const preferredContactChannelValue = value(
      data,
      "preferredContactChannel",
    );

    const preferredContactChannel =
      preferredContactChannelValue === undefined
        ? undefined
        : preferredContactChannelValue as PublicInquiryPreferredContactChannel;

    if (email === undefined && phoneNumber === undefined) {
      setState("error");
      return;
    }

    if (
      preferredContactChannel === "EMAIL" &&
      email === undefined
    ) {
      setState("error");
      return;
    }

    if (
      (
        preferredContactChannel === "PHONE" ||
        preferredContactChannel === "SMS"
      ) &&
      phoneNumber === undefined
    ) {
      setState("error");
      return;
    }

    setState("saving");

    try {
      await api.submitInquiry(propertyId, {
        contactName: String(data.get("contactName")).trim(),
        ...(email === undefined ? {} : { email }),
        ...(phoneNumber === undefined ? {} : { phoneNumber }),
        ...optional(data, "message"),
        intent,
        ...(preferredContactChannel === undefined
          ? {}
          : { preferredContactChannel }),
        consent: true,
        consentVersion: "inquiry-v1",
        idempotencyKey: key,
      });

      setState("success");
      form.current?.reset();
      setKey(crypto.randomUUID());
    } catch (error) {
      setState(
        error instanceof ApiProblem &&
          error.problem.status === 404
          ? "unavailable"
          : "error",
      );
    }
  }

  const title =
    intent === "VIEWING_REQUEST"
      ? "Demander une visite"
      : "Je suis intéressé";

  return (
    <section className="public-inquiry" aria-labelledby="public-inquiry-title">
      <h2 id="public-inquiry-title">{title}</h2>

      <p>
        {intent === "VIEWING_REQUEST"
          ? "Laissez vos coordonnées afin que le gestionnaire puisse organiser une visite avec vous."
          : "Laissez vos coordonnées afin que le gestionnaire puisse vous recontacter au sujet de ce bien."}
        {" "}Aucun compte n’est nécessaire.
      </p>

      {state === "success" && (
        <Alert tone="success" title="Demande envoyée">
          <p>
            Votre demande a bien été transmise. Le gestionnaire pourra
            vous recontacter.
          </p>
        </Alert>
      )}

      {state === "unavailable" && (
        <Alert tone="warning" title="Bien indisponible">
          <p>Ce bien n’est plus ouvert aux demandes.</p>
        </Alert>
      )}

      {state === "error" && (
        <Alert tone="danger" title="Demande non envoyée">
          <p>
            Vérifiez vos coordonnées et le moyen de contact choisi,
            puis réessayez.
          </p>
        </Alert>
      )}

      <form
        ref={form}
        className="form-stack"
        onSubmit={(event) => void submit(event)}
      >
        <Field label="Nom">
          <input
            name="contactName"
            required
            maxLength={200}
          />
        </Field>

        <div className="form-grid">
          <Field label="Téléphone" optional>
            <input
              name="phoneNumber"
              type="tel"
              maxLength={100}
            />
          </Field>

          <Field label="Adresse e-mail" optional>
            <input
              name="email"
              type="email"
              maxLength={320}
            />
          </Field>
        </div>

        <Field label="Moyen de contact préféré" optional>
          <select name="preferredContactChannel" defaultValue="">
            <option value="">Aucune préférence</option>
            <option value="PHONE">Appel téléphonique</option>
            <option value="SMS">SMS</option>
            <option value="EMAIL">E-mail</option>
          </select>
        </Field>

        <Field label="Message" optional>
          <textarea
            name="message"
            maxLength={2000}
          />
        </Field>

        <label className="checkbox-field">
          <input
            name="consent"
            type="checkbox"
            required
          />
          J’accepte que mes coordonnées soient utilisées pour répondre
          à cette demande.
        </label>

        <Button
          type="submit"
          loading={state === "saving"}
          loadingLabel="Envoi…"
        >
          {intent === "VIEWING_REQUEST"
            ? "Envoyer ma demande de visite"
            : "Envoyer ma demande"}
        </Button>
      </form>
    </section>
  );
}

function value(
  data: FormData,
  key: string,
): string | undefined {
  const result = String(data.get(key) ?? "").trim();
  return result.length === 0 ? undefined : result;
}

function optional(
  data: FormData,
  key: string,
): Record<string, string> {
  const result = value(data, key);
  return result === undefined ? {} : { [key]: result };
}