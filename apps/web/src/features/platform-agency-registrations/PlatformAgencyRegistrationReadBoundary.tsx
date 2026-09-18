import { useEffect, useMemo, useState } from "react";
import { Link, Outlet } from "react-router";

import { useSession } from "../../auth/session.js";
import {
  Alert,
  LoadingState,
  buttonClassName,
} from "../../ui/index.js";
import {
  createPlatformAgencyRegistrationAuthorizationApi,
} from "./platform-agency-registration-authorization-api.js";

type AuthorizationState =
  | "checking"
  | "authorized"
  | "forbidden"
  | "error";

export function PlatformAgencyRegistrationReadBoundary() {
  const session = useSession();
  const [state, setState] =
    useState<AuthorizationState>("checking");

  const authorizationApi = useMemo(
    () =>
      createPlatformAgencyRegistrationAuthorizationApi({
        getAccessToken: session.getAccessToken,
      }),
    [session.getAccessToken],
  );

  useEffect(() => {
    let active = true;

    setState("checking");

    void authorizationApi
      .canRetrieveRegistrations()
      .then((authorized) => {
        if (active) {
          setState(authorized ? "authorized" : "forbidden");
        }
      })
      .catch(() => {
        if (active) {
          setState("error");
        }
      });

    return () => {
      active = false;
    };
  }, [authorizationApi]);

  if (state === "checking") {
    return (
      <div className="page-stack">
        <LoadingState label="Vérification de vos autorisations plateforme…" />
      </div>
    );
  }

  if (state === "forbidden") {
    return (
      <div className="page-stack">
        <Alert
          tone="danger"
          title="Accès plateforme non autorisé"
        >
          <p>
            Votre compte ne dispose pas de l'autorisation nécessaire
            pour consulter les inscriptions agences.
          </p>
        </Alert>

        <div>
          <Link
            className={buttonClassName("secondary")}
            to="/"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="page-stack">
        <Alert
          tone="danger"
          title="Vérification des autorisations impossible"
        >
          <p>
            MonPiole n'a pas pu vérifier vos autorisations plateforme.
            Réessayez dans quelques instants.
          </p>
        </Alert>

        <div>
          <Link
            className={buttonClassName("secondary")}
            to="/"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    );
  }

  return <Outlet />;
}