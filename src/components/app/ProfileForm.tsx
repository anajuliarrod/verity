"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/Toast";
import { ApiError, apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { VerityUser } from "@/lib/types";

export interface ProfileFormProps {
  user: VerityUser;
  onUpdated: (user: VerityUser) => void;
  className?: string;
}

const NAME_MAX = 120;
const HEADLINE_MAX = 160;
const BIO_MAX = 280;
const SHORT_MAX = 120;
const WEBSITE_MAX = 200;

interface FormValues {
  name: string;
  headline: string;
  bio: string;
  course: string;
  institution: string;
  location: string;
  websiteUrl: string;
}

type FormField = keyof FormValues;

const FIELDS: readonly FormField[] = [
  "name",
  "headline",
  "bio",
  "course",
  "institution",
  "location",
  "websiteUrl",
];

function toFormValues(user: VerityUser): FormValues {
  return {
    name: user.name ?? "",
    headline: user.headline ?? "",
    bio: user.bio ?? "",
    course: user.course ?? "",
    institution: user.institution ?? "",
    location: user.location ?? "",
    websiteUrl: user.websiteUrl ?? "",
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

type FieldErrors = Partial<Record<FormField, string>>;

/** Espelha, no cliente, a validação feita em `PATCH /api/profile`. */
function validate(values: FormValues): FieldErrors {
  const errors: FieldErrors = {};

  if (values.name.trim().length > NAME_MAX) {
    errors.name = `Nome deve ter no máximo ${NAME_MAX} caracteres.`;
  }
  if (values.headline.trim().length > HEADLINE_MAX) {
    errors.headline = `Título deve ter no máximo ${HEADLINE_MAX} caracteres.`;
  }
  if (values.bio.trim().length > BIO_MAX) {
    errors.bio = `Bio deve ter no máximo ${BIO_MAX} caracteres.`;
  }
  if (values.course.trim().length > SHORT_MAX) {
    errors.course = `Curso deve ter no máximo ${SHORT_MAX} caracteres.`;
  }
  if (values.institution.trim().length > SHORT_MAX) {
    errors.institution = `Instituição deve ter no máximo ${SHORT_MAX} caracteres.`;
  }
  if (values.location.trim().length > SHORT_MAX) {
    errors.location = `Localização deve ter no máximo ${SHORT_MAX} caracteres.`;
  }
  const website = values.websiteUrl.trim();
  if (website.length > WEBSITE_MAX) {
    errors.websiteUrl = `Site deve ter no máximo ${WEBSITE_MAX} caracteres.`;
  } else if (website !== "" && !isHttpUrl(website)) {
    errors.websiteUrl = "Informe uma URL http:// ou https:// válida.";
  }

  return errors;
}

const inputClass =
  "focus-ring h-10 w-full rounded-input border border-verity-border bg-white px-3 text-sm text-verity-ink placeholder:text-verity-ink-muted disabled:cursor-not-allowed disabled:opacity-60";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}

function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium text-verity-ink">
        {label}
      </label>
      {hint && <p className="mt-0.5 text-xs text-verity-ink-muted">{hint}</p>}
      <div className="mt-1">{children}</div>
      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Formulário de edição de perfil (`PATCH /api/profile`). Envia apenas os
 * campos que mudaram em relação ao que foi carregado, com validação no
 * cliente espelhando a do servidor e feedback por toast.
 */
export function ProfileForm({ user, onUpdated, className }: ProfileFormProps) {
  const { toast } = useToast();
  const [initial, setInitial] = useState<FormValues>(() => toFormValues(user));
  const [values, setValues] = useState<FormValues>(() => toFormValues(user));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const dirtyFields = useMemo(
    () => FIELDS.filter((field) => values[field].trim() !== initial[field].trim()),
    [values, initial],
  );
  const isDirty = dirtyFields.length > 0;

  function updateField<K extends FormField>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    if (status !== "idle") setStatus("idle");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const fieldErrors = validate(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0 || !isDirty) return;

    const patch: Partial<Record<FormField, string>> = {};
    for (const field of dirtyFields) {
      patch[field] = values[field].trim();
    }

    setStatus("saving");
    try {
      const updated = await apiFetch<VerityUser>("/api/profile", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      onUpdated(updated);
      const nextValues = toFormValues(updated);
      setInitial(nextValues);
      setValues(nextValues);
      setStatus("saved");
      toast({ title: "Perfil atualizado.", tone: "success" });
    } catch (cause) {
      setStatus("error");
      toast({
        title: "Não foi possível salvar o perfil.",
        description:
          cause instanceof ApiError ? cause.message : "Tente novamente em instantes.",
        tone: "error",
      });
    }
  }

  const saving = status === "saving";

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Editar perfil</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Field label="Nome" id="profile-name" error={errors.name}>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              maxLength={NAME_MAX}
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={errors.name ? "profile-name-error" : undefined}
              className={inputClass}
            />
          </Field>

          <Field
            label="Título"
            id="profile-headline"
            hint='Ex.: "Estudante de Engenharia de Software"'
            error={errors.headline}
          >
            <input
              id="profile-headline"
              name="headline"
              type="text"
              maxLength={HEADLINE_MAX}
              value={values.headline}
              onChange={(event) => updateField("headline", event.target.value)}
              aria-invalid={Boolean(errors.headline) || undefined}
              aria-describedby={errors.headline ? "profile-headline-error" : undefined}
              className={inputClass}
            />
          </Field>

          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="profile-bio" className="text-sm font-medium text-verity-ink">
                Bio
              </label>
              <span
                className={cn(
                  "text-xs",
                  values.bio.length > BIO_MAX ? "text-red-600" : "text-verity-ink-muted",
                )}
              >
                {values.bio.length}/{BIO_MAX}
              </span>
            </div>
            <textarea
              id="profile-bio"
              name="bio"
              rows={3}
              maxLength={BIO_MAX}
              value={values.bio}
              onChange={(event) => updateField("bio", event.target.value)}
              aria-invalid={Boolean(errors.bio) || undefined}
              aria-describedby={errors.bio ? "profile-bio-error" : undefined}
              className={cn(inputClass, "h-auto resize-none py-2")}
            />
            {errors.bio && (
              <p id="profile-bio-error" role="alert" className="mt-1 text-xs text-red-600">
                {errors.bio}
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Curso" id="profile-course" error={errors.course}>
              <input
                id="profile-course"
                name="course"
                type="text"
                placeholder="Engenharia de Software"
                maxLength={SHORT_MAX}
                value={values.course}
                onChange={(event) => updateField("course", event.target.value)}
                aria-invalid={Boolean(errors.course) || undefined}
                aria-describedby={errors.course ? "profile-course-error" : undefined}
                className={inputClass}
              />
            </Field>
            <Field label="Instituição" id="profile-institution" error={errors.institution}>
              <input
                id="profile-institution"
                name="institution"
                type="text"
                maxLength={SHORT_MAX}
                value={values.institution}
                onChange={(event) => updateField("institution", event.target.value)}
                aria-invalid={Boolean(errors.institution) || undefined}
                aria-describedby={errors.institution ? "profile-institution-error" : undefined}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Localização" id="profile-location" error={errors.location}>
              <input
                id="profile-location"
                name="location"
                type="text"
                autoComplete="address-level2"
                maxLength={SHORT_MAX}
                value={values.location}
                onChange={(event) => updateField("location", event.target.value)}
                aria-invalid={Boolean(errors.location) || undefined}
                aria-describedby={errors.location ? "profile-location-error" : undefined}
                className={inputClass}
              />
            </Field>
            <Field label="Site" id="profile-website" error={errors.websiteUrl}>
              <input
                id="profile-website"
                name="websiteUrl"
                type="url"
                inputMode="url"
                placeholder="https://"
                maxLength={WEBSITE_MAX}
                value={values.websiteUrl}
                onChange={(event) => updateField("websiteUrl", event.target.value)}
                aria-invalid={Boolean(errors.websiteUrl) || undefined}
                aria-describedby={errors.websiteUrl ? "profile-website-error" : undefined}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-verity-border pt-4">
            {status === "saved" && !isDirty && (
              <p className="text-xs text-verity-verified" role="status">
                Salvo.
              </p>
            )}
            <Button type="submit" loading={saving} disabled={!isDirty || saving}>
              Salvar alterações
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
