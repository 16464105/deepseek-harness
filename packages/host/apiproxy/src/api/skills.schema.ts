/**
 * skills domain zod schemas (names derived from map keys: skillListRequestSchema /
 * skillListValueSchema).
 */

import { z } from 'zod'
import type { RequestPayload, ResponseValue } from './rpc-map.ts'
import type { Wire } from './rpc.schema.ts'
import { sessionIdSchema } from './sessions.schema.ts'
import type { SkillDirectoryInfo, SkillEntry } from './skills.ts'

/** SkillEntry row of skill.list. */
export const skillEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  whenToUse: z.string().optional(),
  modelInvocable: z.boolean(),
  source: z.string(),
  provider: z.string(),
}) satisfies z.ZodType<Wire<SkillEntry>>

/** User skills directory row of skill.list. */
export const skillDirectoryInfoSchema = z.object({
  openDirectory: z.string().min(1),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<SkillDirectoryInfo>>

/** skill.list request payload. */
export const skillListRequestSchema = z.object({
  sessionId: sessionIdSchema,
  refresh: z.boolean().optional(),
}) satisfies z.ZodType<Wire<RequestPayload<'skill.list'>>>

/** skill.list response value. */
export const skillListValueSchema = z.object({
  skills: z.array(skillEntrySchema),
  openDirectory: z.string().min(1),
  canOpenPath: z.boolean(),
}) satisfies z.ZodType<Wire<ResponseValue<'skill.list'>>>
