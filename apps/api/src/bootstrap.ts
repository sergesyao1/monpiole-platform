import "reflect-metadata";

import { type NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";

import { AppModule } from "./app.module.js";
import type { ApiComposition } from "./app.module.js";

export async function createApiApplication(options?: NestApplicationOptions, composition?: ApiComposition) {
  const application = await NestFactory.create<NestExpressApplication>(AppModule.register(composition), options);
  application.useBodyParser("json", { limit: "20mb" });
  return application;
}
