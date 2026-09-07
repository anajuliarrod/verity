/**
 * Helpers compartilhados pelas rotas de `src/app/api/**` (exceto
 * `attestations/`, de outro agente). Não é uma rota — não exporta nenhum
 * handler HTTP, então o App Router o ignora no roteamento.
 */

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { apiErr, apiOk, type ApiErrorCode } from "@/lib/types";

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  GITHUB_ERROR: 502,
  SOLANA_ERROR: 502,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(apiOk(data), { status });
}

export function jsonFail(code: ApiErrorCode, message: string): NextResponse {
  return NextResponse.json(apiErr(code, message), { status: STATUS_BY_CODE[code] });
}

/** Erro de negócio esperado, mapeado diretamente para o envelope de erro da API. */
export class HttpError extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = "HttpError";
    this.code = code;
  }
}

/**
 * Envolve um handler de rota, convertendo qualquer erro lançado (validação,
 * `HttpError` de negócio, ou erro inesperado) no envelope padrão da API.
 * Nunca vaza stack trace para o cliente.
 */
export function withErrorHandling(
  handler: (request: Request, context: unknown) => Promise<NextResponse>,
) {
  return async (request: Request, context: unknown): Promise<NextResponse> => {
    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonFail(error.code, error.message);
      }
      if (error instanceof ZodError) {
        const message = error.issues.map((issue) => issue.message).join("; ");
        return jsonFail("VALIDATION_ERROR", message || "Dados inválidos.");
      }
      console.error("[api] erro não tratado:", error);
      return jsonFail("INTERNAL_ERROR", "Erro interno inesperado.");
    }
  };
}

/** Lê e faz parse de JSON do corpo da requisição, tratando corpo vazio/ inválido. */
export async function readJsonBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError("VALIDATION_ERROR", "Corpo da requisição não é um JSON válido.");
  }
}
