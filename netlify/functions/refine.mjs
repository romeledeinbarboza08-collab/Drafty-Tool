// =========================================================
// POST /api/refine
// Recibe { accion, texto, contexto } y devuelve { texto }
// con el fragmento reescrito por la IA.
// =========================================================

import { generar, respuestaDeError } from "../lib/gemini.mjs";
import { ACCIONES, SYSTEM_EDICION, promptEdicion } from "../lib/prompts.mjs";

const MAX_FRAGMENTO = 4000;
const MAX_CONTEXTO = 1500;

export default async (req) => {
  if (req.method !== "POST") {
    return Response.json({ error: "Método no permitido." }, { status: 405 });
  }

  let datos;
  try {
    datos = await req.json();
  } catch {
    return Response.json({ error: "La solicitud no tiene un formato válido." }, { status: 400 });
  }

  const accion = datos?.accion;
  const texto = String(datos?.texto ?? "").trim();
  const contexto = String(datos?.contexto ?? "").slice(0, MAX_CONTEXTO);

  if (!ACCIONES[accion]) {
    return Response.json({ error: "Acción no reconocida." }, { status: 400 });
  }
  if (texto.length < 3) {
    return Response.json({ error: "Selecciona un poco más de texto." }, { status: 400 });
  }
  if (texto.length > MAX_FRAGMENTO) {
    return Response.json({ error: "El fragmento es demasiado largo. Selecciona una parte más pequeña." }, { status: 400 });
  }

  try {
    const resultado = await generar({
      system: SYSTEM_EDICION,
      prompt: promptEdicion(accion, texto, contexto)
    });

    return Response.json({ texto: limpiar(resultado) });
  } catch (err) {
    return respuestaDeError(err);
  }
};

// A veces el modelo envuelve la respuesta en comillas o en ```.
// Esto lo deja como texto limpio.
function limpiar(texto) {
  return texto
    .trim()
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/\n?```$/, "")
    .replace(/^"""\n?|\n?"""$/g, "")
    .replace(/^["“](.*)["”]$/s, "$1")
    .trim();
}
