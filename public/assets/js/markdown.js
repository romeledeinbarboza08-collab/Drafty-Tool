// =========================================================
// Convertidor de Markdown a HTML
// Es pequeño a propósito: solo entiende lo que usa un contrato
// (títulos, párrafos, negritas, listas y líneas). Primero escapa
// el HTML para que nada que venga de la IA se ejecute como código.
// =========================================================

export function escapar(texto) {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Formato dentro de una línea: negritas, cursivas y marcadores [..]
export function formatoEnLinea(texto) {
  return escapar(texto)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/\[([^\]\n]{2,90})\]/g, '<span class="ph">[$1]</span>');
}

export function markdownAHtml(markdown) {
  const lineas = quitarCercas(markdown).split("\n");
  const html = [];
  let parrafo = [];
  let lista = null; // "ul" u "ol"

  const cerrarParrafo = () => {
    if (parrafo.length) {
      html.push(`<p>${parrafo.map(formatoEnLinea).join("<br>")}</p>`);
      parrafo = [];
    }
  };

  const cerrarLista = () => {
    if (lista) {
      html.push(`</${lista}>`);
      lista = null;
    }
  };

  for (const linea of lineas) {
    const texto = linea.trim();

    if (texto === "") {
      cerrarParrafo();
      cerrarLista();
      continue;
    }

    const titulo = texto.match(/^(#{1,3})\s+(.*)$/);
    if (titulo) {
      cerrarParrafo();
      cerrarLista();
      const nivel = titulo[1].length;
      html.push(`<h${nivel}>${formatoEnLinea(titulo[2])}</h${nivel}>`);
      continue;
    }

    if (/^(-{3,}|\*{3,})$/.test(texto)) {
      cerrarParrafo();
      cerrarLista();
      html.push("<hr>");
      continue;
    }

    const vineta = texto.match(/^[-*•]\s+(.*)$/);
    const numero = texto.match(/^\d+[.)]\s+(.*)$/);
    if (vineta || numero) {
      cerrarParrafo();
      const tipo = vineta ? "ul" : "ol";
      if (lista !== tipo) {
        cerrarLista();
        html.push(`<${tipo}>`);
        lista = tipo;
      }
      html.push(`<li>${formatoEnLinea((vineta || numero)[1])}</li>`);
      continue;
    }

    cerrarLista();
    parrafo.push(texto);
  }

  cerrarParrafo();
  cerrarLista();
  return html.join("\n");
}

// Por si el modelo envuelve todo en ```markdown ... ```
function quitarCercas(texto) {
  return texto.replace(/^\s*```[a-z]*\s*\n/i, "").replace(/\n```\s*$/, "");
}
