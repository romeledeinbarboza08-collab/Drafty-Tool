// =========================================================
// POST /api/generate
// Recibe { tipo, descripcion } y devuelve el contrato en
// Markdown por streaming, a medida que Gemini lo va escribiendo.
// =========================================================

import { generarStream, respuestaDeError } from "../lib/gemini.mjs";
import { SYSTEM_CONTRATO, TIPOS, promptContrato } from "../lib/prompts.mjs";

const MIN_CHARS = 10;
const MAX_CHARS = 2000;

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Método no permitido." }, { status: 405 });
  }

  // 1. Validar lo que manda el navegador
  let datos;
  try {
    datos = await req.json();
  } catch {
    return Response.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
  }

  const tipo = TIPOS[datos?.tipo] ? datos.tipo : "personalizado";
  const descripcion = String(datos?.descripcion ?? "").trim();

  if (descripcion.length < MIN_CHARS) {
    return Response.json({ error: "Describe tu contrato con un poco más de detalle." }, { status: 400 });
  }
  if (descripcion.length > MAX_CHARS) {
    return Response.json({ error: `La descripción no puede pasar de ${MAX_CHARS} caracteres.` }, { status: 400 });
  }

  // 2. Pedirle el contrato a Gemini
  let partes;
  try {
    partes = await generarStream({
      system: SYSTEM_CONTRATO,
      prompt: promptContrato(tipo, descripcion)
    });
  } catch (err) {
    return respuestaDeError(err);
  }

  // 3. Reenviar el texto al navegador pedazo por pedazo
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const texto of partes) {
          controller.enqueue(encoder.encode(texto));
        }
        // Marca de que el contrato llegó completo. Si Netlify corta la
        // función por tiempo, esta marca nunca llega y el navegador
        // sabe que el texto quedó incompleto.
        controller.enqueue(encoder.encode("\n[[DRAFTY_FIN]]"));
      } catch (err) {
        console.error("[drafty] stream cortado", err);
        // Marca especial para que el navegador sepa que algo falló a mitad
        controller.enqueue(encoder.encode("\n[[DRAFTY_ERROR]]"));
      }
      controller.close();
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache"
    }
  });
};
