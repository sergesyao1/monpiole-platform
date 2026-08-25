import { z } from "zod";

const nilUuid = "00000000-0000-0000-0000-000000000000";

export const eventIdSchema = z.uuid().refine((value) => value !== nilUuid, {
  message: "eventId must not be the nil UUID",
});

export const correlationIdSchema = z.uuid();

export const causationIdSchema = z.uuid();

export const eventTypeSchema = z
  .string()
  .regex(/^monpiole\.[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)+$/);

export const eventVersionSchema = z.int().positive();

export const producerSchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/)
  .max(63);

export const tenantIdSchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9_-]{2,63}$/);

export const occurredAtSchema = z.iso.datetime({ offset: false }).refine(
  (value) => value.endsWith("Z"),
  { message: "occurredAt must use an explicit UTC Z suffix" },
);
