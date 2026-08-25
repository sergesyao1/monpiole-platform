import "reflect-metadata";

import { type NestApplicationOptions } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app.module.js";

export function createApiApplication(options?: NestApplicationOptions) {
  return NestFactory.create(AppModule, options);
}
