import "@nestjs/common";
import "@nestjs/microservices";
import "amqplib";
import "kafkajs";
import "nats";
import "redis";
import "typeorm";

import "../../../apps/api/src/index.js";
import "../../../services/billing/infrastructure/persistence/repository.js";

export const forbiddenEventsPackageOuterTechnology = true;
