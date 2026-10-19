// =========================================================
// Cliente de Gemini
// Es el único archivo que sabe cómo hablar con la API de Google.
// Si algún día se cambia de proveedor (Groq, OpenAI...), solo
// se reescribe este archivo y las funciones siguen igual.
// =========================================================

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const MODELO_POR_DEFECTO = "gemini-3.8-flash";

export class GeminiError extends Error {
  constructor(mensaje, status) {
    super(mensaje);
    this.status = status;
  }
}

// Cuánto "piensa" el modelo antes de escribir. Menos razonamiento
// = respuesta más rápida. Netlify corta las funciones a los 30 s,
// así que para redactar contratos conviene que piense poco.
const RAZONAMIENTO_POR_DEFECTO = "low";

function configuracion() {
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  const modelo = Netlify.env.get("GEMINI_MODEL") || MODELO_POR_DEFECTO;
  const razonamiento = Netlify.env.get("GEMINI_THINKING") || RAZONAMIENTO_POR_DEFECTO;

  if (!apiKey) {
    throw new GeminiError("Falta la variable GEMINI_API_KEY en Netlify.", 500);
  }

  return { apiKey, modelo, razonamiento };
}

function armarPeticion(system, prompt, apiKey, razonamiento) {
  const cuerpo = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }]
  };

  if (razonamiento) {
    cuerpo.generationConfig = { thinkingConfig: { thinkingLevel: razonamiento } };
  }

  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify(cuerpo)
  };
}

// Hace la petición. Si el modelo configurado no acepta el ajuste de
// razonamiento (error 400), se reintenta una vez sin ese ajuste.
async function pedir(url, system, prompt) {
  const { apiKey, razonamiento } = configuracion();

  let res = await fetch(url, armarPeticion(system, prompt, apiKey, razonamiento));

  if (res.status === 400 && razonamiento) {
    const detalle = await res.clone().text();
    if (/thinking/i.test(detalle)) {
      console.warn("[drafty] el modelo no aceptó thinkingLevel, reintentando sin él");
      res = await fetch(url, armarPeticion(system, prompt, apiKey, null));
    }
  }

  if (!res.ok) await lanzarErrorDe(res);
  return res;
}

// Junta el texto de todas las "parts" de la primera respuesta
function extraerTexto(data) {
  const partes = data?.candidates?.[0]?.content?.parts ?? [];
  return partes.map((p) => p.text ?? "").join("");
}

async function lanzarErrorDe(res) {
  const data = await res.json().catch(() => ({}));
  throw new GeminiError(data?.error?.message || "Gemini no respondió correctamente.", res.status);
}

// Respuesta completa de una sola vez (para las acciones de edición)
export async function generar({ system, prompt }) {
  const { modelo } = configuracion();

  const res = await pedir(`${BASE_URL}/${modelo}:generateContent`, system, prompt);
  const data = await res.json();
  return extraerTexto(data);
}

// Respuesta por partes (streaming). Primero confirma que Gemini aceptó
// la petición, y si todo está bien devuelve un generador que va
// entregando el texto a medida que llega.
export async function generarStream({ system, prompt }) {
  const { modelo } = configuracion();

  const res = await pedir(`${BASE_URL}/${modelo}:streamGenerateContent?alt=sse`, system, prompt);
  return leerEventos(res.body);
}

// Gemini manda eventos SSE: líneas que empiezan con "data: {json}".
// Se leen por pedazos porque un evento puede llegar cortado a la mitad.
async function* leerEventos(body) {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lineas = buffer.split("\n");
    buffer = lineas.pop();

    for (const linea of lineas) {
      const limpia = linea.trim();
      if (!limpia.startsWith("data:")) continue;

      try {
        const texto = extraerTexto(JSON.parse(limpia.slice(5)));
        if (texto) yield texto;
      } catch {
        // Si una línea viene incompleta o rara, se ignora
      }
    }
  }
}

// Convierte cualquier error en una respuesta clara para el navegador
export function respuestaDeError(err) {
  console.error("[drafty]", err);

  if (err instanceof GeminiError && err.status === 429) {
    return Response.json(
      { error: "Se alcanzó el límite de uso de la IA. Espera un minuto e intenta de nuevo." },
      { status: 429 }
    );
  }

  return Response.json(
    { error: "No pudimos conectar con la IA en este momento. Intenta de nuevo." },
    { status: 502 }
  );
}
