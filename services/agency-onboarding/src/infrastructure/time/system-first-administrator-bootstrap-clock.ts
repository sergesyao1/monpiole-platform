import type {
  FirstAdministratorBootstrapClock,
} from "../../application/first-administrator-bootstrap.js";

export class SystemFirstAdministratorBootstrapClock
  implements FirstAdministratorBootstrapClock
{
  now(): string {
    return new Date().toISOString();
  }
}