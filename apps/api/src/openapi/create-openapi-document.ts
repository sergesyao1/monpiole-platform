import type { INestApplication } from "@nestjs/common";
import {
  DocumentBuilder,
  SwaggerModule,
  type OpenAPIObject,
} from "@nestjs/swagger";
import { cleanupOpenApiDoc } from "nestjs-zod";

export function createOpenApiDocument(
  application: INestApplication,
): OpenAPIObject {
  const configuration = new DocumentBuilder()
    .setTitle("MonPiole Public API")
    .setDescription("Versioned MonPiole HTTP transport contracts")
    .setVersion("1.0.0")
    .setOpenAPIVersion("3.1.0")
    .addBearerAuth(
      { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      "bearer",
    )
    .build();
  const document = SwaggerModule.createDocument(application, configuration);
  return cleanupOpenApiDoc(document, { version: "3.1" });
}
