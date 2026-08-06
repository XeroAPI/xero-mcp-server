import { z } from "zod";

export const reportPeriodsSchema = z.number().int().min(1).max(11);
