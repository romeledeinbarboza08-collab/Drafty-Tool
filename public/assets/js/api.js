// =========================================================
// API de Drafty
// Única parte del frontend que habla con el backend (/api/...).
// El navegador nunca ve la API key: solo llama a nuestras funciones.
// =========================================================

const MARCA_ERROR = "[[DRAFTY_ERROR]]";

async function leerError(res, mensajePorDefecto) {
  const data = await res.json().catch(() => ({}));
  return new Error(data.error || mensajePorDefecto);
}

// Genera el contrato y va llamando a alRecibir(textoAcumulado)
// cada vez que llega un pedazo nuevo.
export async function generarContrato({ tipo, descripcion }, alRecibir, signal) {
  const res = await fetch("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tipo, descripcion }),
    signal
  });

  if (!res.ok) {
    throw await leerError(res, "No pudimos generar el contrato. Intenta de nuevo.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let texto = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    texto += decoder.decode(value, { stream: true });

    if (texto.includes(MARCA_ERROR)) {
      throw new Error("La generación se interrumpió. Intenta de nuevo.");
    }

    alRecibir(texto);
  }

  if (texto.trim().length === 0) {
    throw new Error("La IA no devolvió ningún texto. Intenta de nuevo.");
  }

  return texto;
}

export async function refinarTexto({ accion, texto, contexto }) {
  const res = await fetch("/api/refine", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accion, texto, contexto })
  });

  if (!res.ok) {
    throw await leerError(res, "No pudimos editar ese fragmento. Intenta de nuevo.");
  }

  const data = await res.json();
  return data.texto;
}
