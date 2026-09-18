import type {
  FirstAdministratorExternalIdentityLinkPort,
  LinkFirstAdministratorExternalIdentityInput,
  LinkedFirstAdministratorExternalIdentity,
} from "@monpiole/agency-onboarding";
import {
  ExternalIdentity,
  type ExternalIdentityLinkStore,
} from "@monpiole/identity";

export class AgencyExternalIdentityLinkAdapter
  implements FirstAdministratorExternalIdentityLinkPort
{
  public constructor(
    private readonly externalIdentities: ExternalIdentityLinkStore,
  ) {}

  public canonicalize(
    input: LinkFirstAdministratorExternalIdentityInput,
  ): LinkedFirstAdministratorExternalIdentity {
    const externalIdentity = this.createExternalIdentity(input);

    return {
      issuer: externalIdentity.issuer,
      subject: externalIdentity.subject,
    };
  }

  public async link(
    input: LinkFirstAdministratorExternalIdentityInput,
  ): Promise<LinkedFirstAdministratorExternalIdentity> {
    const externalIdentity = this.createExternalIdentity(input);

    await this.externalIdentities.link(externalIdentity);

    return {
      issuer: externalIdentity.issuer,
      subject: externalIdentity.subject,
    };
  }

  private createExternalIdentity(
    input: LinkFirstAdministratorExternalIdentityInput,
  ): ExternalIdentity {
    return ExternalIdentity.create({
      issuer: input.issuer,
      subject: input.subject,
      internalIdentityId: input.internalIdentityId,
      tenantId: input.tenantId,
      createdAt: input.createdAt,
    });
  }
}