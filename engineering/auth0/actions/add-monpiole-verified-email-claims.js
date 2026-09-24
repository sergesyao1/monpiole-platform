/**
 * Auth0 Post Login Action for access tokens issued to a MonPiole API.
 *
 * Deploy this Action in the Auth0 tenant and bind it to the Post Login flow.
 * Configure the MONPIOLE_API_AUDIENCE Action secret with the exact
 * AUTHENTICATION_AUDIENCE value.
 */
exports.onExecutePostLogin = async (event, api) => {
  const audience = event.resource_server?.identifier;
  const monPioleAudience = event.secrets?.MONPIOLE_API_AUDIENCE;

  if (
    typeof monPioleAudience !== "string" ||
    !monPioleAudience.startsWith("https://") ||
    audience !== monPioleAudience
  ) {
    return;
  }

  const namespace = audience.replace(/\/$/u, "");
  const email = event.user.email;

  if (typeof email === "string" && email.trim().length > 0) {
    api.accessToken.setCustomClaim(
      `${namespace}/claims/email`,
      email.trim(),
    );
  }

  api.accessToken.setCustomClaim(
    `${namespace}/claims/email_verified`,
    event.user.email_verified === true,
  );
};
