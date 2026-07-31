import path from "node:path";
import { z } from "zod";

const schema = z.object({
  DHP_RUNTIME_ROOT: z.string().min(1).default("./runtime"),
  DHP_AUDIT_ROOT: z.string().min(1).default("./runtime/audit"),
});

const parsed = schema.parse(process.env);

export const config = {
  runtimeRoot: path.resolve(parsed.DHP_RUNTIME_ROOT),
  auditRoot: path.resolve(parsed.DHP_AUDIT_ROOT),
};
