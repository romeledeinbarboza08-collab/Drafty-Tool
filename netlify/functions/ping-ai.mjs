export default async () => {
  const apiKey = Netlify.env.get("GEMINI_API_KEY");
  const model = Netlify.env.get("GEMINI_MODEL") || "gemini-3.8-flash";

  if (!apiKey) {
    return Response.json({ error: "Falta la variable GEMINI_API_KEY" }, { status: 500 });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: "Escribe en una sola oración una cláusula de confidencialidad para un contrato de servicios." }]
      }]
    })
  });

  const data = await res.json();

  if (!res.ok) {
    return Response.json({ error: data.error?.message || "Error con Gemini", status: res.status }, { status: 502 });
  }

  const texto = data.candidates?.[0]?.content?.parts?.map(p => p.text).join("") ?? "";
  return Response.json({ model, texto });
};