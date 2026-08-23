import "./cycle-b.js";
import "../infrastructure/persistence/repository.js";
import { readFileSync } from "node:fs";

export const forbiddenRuntimeAccess = readFileSync;
