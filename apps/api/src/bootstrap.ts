import "reflect-metadata";

import { type NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";
import type { ApiComposition } from "./app.module.js";

export function createApiApplication(options?: NestApplicationOptions, composition?: ApiComposition) {
  return NestFactory.create(AppModule.register(composition), options);
}
