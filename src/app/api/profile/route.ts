/**
 * PATCH /api/profile: edita os campos de perfil do usuário da sessão atual.
 * Todos os campos do corpo são opcionais; só os enviados são atualizados
 * ("salvar só o que mudou" é responsabilidade do cliente, que deve enviar
 * apenas os campos alterados). Uma string vazia limpa o campo (grava
 * `null`), já que todos são opcionais no schema.
 */

import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { HttpError, jsonOk, readJsonBody, withErrorHandling } from "@/app/api/_lib/http";
import { serializeUser } from "@/app/api/_lib/serializers";

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const bodySchema = z.object({
  name: z.string().trim().max(120, "Nome deve ter no máximo 120 caracteres.").optional(),
  headline: z
    .string()
    .trim()
    .max(160, "Título deve ter no máximo 160 caracteres.")
    .optional(),
  bio: z.string().trim().max(280, "Bio deve ter no máximo 280 caracteres.").optional(),
  course: z.string().trim().max(120, "Curso deve ter no máximo 120 caracteres.").optional(),
  institution: z
    .string()
    .trim()
    .max(120, "Instituição deve ter no máximo 120 caracteres.")
    .optional(),
  location: z
    .string()
    .trim()
    .max(120, "Localização deve ter no máximo 120 caracteres.")
    .optional(),
  websiteUrl: z
    .string()
    .trim()
    .max(200, "Site deve ter no máximo 200 caracteres.")
    .refine((value) => value === "" || isHttpUrl(value), {
      message: "Informe uma URL http:// ou https:// válida.",
    })
    .optional(),
});

type EditableField = keyof z.infer<typeof bodySchema>;

const EDITABLE_FIELDS: readonly EditableField[] = [
  "name",
  "headline",
  "bio",
  "course",
  "institution",
  "location",
  "websiteUrl",
];

export const PATCH = withErrorHandling(async (request) => {
  const user = await requireUser();
  if (!user) {
    throw new HttpError("UNAUTHORIZED", "É necessário estar em uma sessão ativa.");
  }

  const parsed = bodySchema.parse(await readJsonBody(request));

  const data: Partial<Record<EditableField, string | null>> = {};
  for (const field of EDITABLE_FIELDS) {
    const value = parsed[field];
    if (value === undefined) continue;
    data[field] = value === "" ? null : value;
  }

  const updated = await db.user.update({ where: { id: user.id }, data });
  return jsonOk(serializeUser(updated));
});
