// =========================================================
// Exportar a PDF
// Arma un PDF real (con texto seleccionable) a partir del
// contrato que está en pantalla, usando la librería jsPDF.
// Se recorre el HTML del documento y se va "dibujando" cada
// título, párrafo y lista en la hoja, saltando de página
// cuando ya no cabe.
// =========================================================

const PAGINA = { ancho: 612, alto: 792 };            // Carta, en puntos
const MARGEN = { arriba: 72, abajo: 72, lados: 68 };
const ANCHO_UTIL = PAGINA.ancho - MARGEN.lados * 2;

const TAM = { cuerpo: 11.5, h1: 14, h2: 11.5, pie: 8.5 };
const INTERLINEA = 1.55;

const FUENTE = "LiberationSerif";
const ARCHIVOS_FUENTE = {
  normal: "/assets/fonts/LiberationSerif-Regular.ttf",
  bold: "/assets/fonts/LiberationSerif-Bold.ttf",
  italic: "/assets/fonts/LiberationSerif-Italic.ttf"
};

// ---------- Carga de jsPDF y de las fuentes (solo la primera vez) ----------
let listo = null;

function cargarLibreria() {
  if (window.jspdf) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/assets/vendor/jspdf.umd.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("No se pudo cargar el generador de PDF."));
    document.head.appendChild(script);
  });
}

async function descargarFuente(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("No se pudo cargar la fuente del PDF.");
  const bytes = new Uint8Array(await res.arrayBuffer());

  // jsPDF necesita la fuente en base64
  let binario = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binario);
}

function prepararTodo() {
  if (!listo) {
    listo = Promise.all([
      cargarLibreria(),
      ...Object.entries(ARCHIVOS_FUENTE).map(async ([estilo, url]) => [estilo, await descargarFuente(url)])
    ]).then(([, ...fuentes]) => fuentes);
    // Si algo falla, que se pueda volver a intentar
    listo.catch(() => (listo = null));
  }
  return listo;
}

// ---------- Leer el documento ----------
// Convierte el HTML del contrato en una lista de bloques simples:
// { tipo: "h1" | "h2" | "p" | "li" | "hr", trozos: [{ texto, estilo }] }
function leerBloques(documento) {
  const bloques = [];

  for (const nodo of documento.childNodes) {
    if (nodo.nodeType === Node.TEXT_NODE) {
      if (nodo.textContent.trim()) bloques.push({ tipo: "p", trozos: [{ texto: nodo.textContent, estilo: "normal" }] });
      continue;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) continue;

    const etiqueta = nodo.tagName.toLowerCase();

    if (etiqueta === "hr") {
      bloques.push({ tipo: "hr" });
    } else if (etiqueta === "ul" || etiqueta === "ol") {
      [...nodo.children].forEach((li, i) => {
        bloques.push({
          tipo: "li",
          marca: etiqueta === "ol" ? `${i + 1}.` : "•",
          trozos: leerTrozos(li, "normal")
        });
      });
    } else {
      const tipo = etiqueta === "h1" ? "h1" : /^h[2-6]$/.test(etiqueta) ? "h2" : "p";
      const trozos = leerTrozos(nodo, tipo === "p" ? "normal" : "bold");
      if (trozos.some((t) => t.texto.trim())) bloques.push({ tipo, trozos });
    }
  }

  return bloques;
}

function leerTrozos(elemento, estiloBase) {
  const trozos = [];

  const recorrer = (nodo, estilo) => {
    if (nodo.nodeType === Node.TEXT_NODE) {
      trozos.push({ texto: nodo.textContent, estilo });
      return;
    }
    if (nodo.nodeType !== Node.ELEMENT_NODE) return;

    const etiqueta = nodo.tagName.toLowerCase();
    if (etiqueta === "br") {
      trozos.push({ texto: "\n", estilo });
      return;
    }

    let nuevo = estilo;
    if (etiqueta === "strong" || etiqueta === "b") nuevo = "bold";
    else if ((etiqueta === "em" || etiqueta === "i") && estilo !== "bold") nuevo = "italic";

    nodo.childNodes.forEach((hijo) => recorrer(hijo, nuevo));
  };

  elemento.childNodes.forEach((hijo) => recorrer(hijo, estiloBase));
  return trozos;
}

// ---------- Acomodar el texto en líneas ----------
// Cada "palabra" puede tener partes con estilos distintos,
// por ejemplo una palabra en negrita seguida de una coma normal.
function partirEnPalabras(trozos) {
  const palabras = [];
  let actual = null;

  for (const { texto, estilo } of trozos) {
    const piezas = texto.split(/(\s+)/);
    for (const pieza of piezas) {
      if (pieza === "") continue;

      if (/^\s+$/.test(pieza)) {
        if (actual) palabras.push(actual);
        actual = null;
        if (pieza.includes("\n")) palabras.push({ saltoDeLinea: true });
        continue;
      }

      if (!actual) actual = { partes: [] };
      actual.partes.push({ texto: pieza, estilo });
    }
  }
  if (actual) palabras.push(actual);
  return palabras;
}

function medir(pdf, palabra, tam) {
  return palabra.partes.reduce((total, p) => {
    pdf.setFont(FUENTE, p.estilo);
    return total + pdf.getTextWidth(p.texto);
  }, 0);
}

function armarLineas(pdf, palabras, anchoMax, tam) {
  pdf.setFontSize(tam);
  pdf.setFont(FUENTE, "normal");
  const espacio = pdf.getTextWidth(" ");

  const lineas = [];
  let linea = { palabras: [], ancho: 0, forzada: false };

  for (const palabra of palabras) {
    if (palabra.saltoDeLinea) {
      linea.forzada = true;
      lineas.push(linea);
      linea = { palabras: [], ancho: 0, forzada: false };
      continue;
    }

    palabra.ancho = medir(pdf, palabra, tam);
    const anchoConEsta = linea.ancho + (linea.palabras.length ? espacio : 0) + palabra.ancho;

    if (anchoConEsta > anchoMax && linea.palabras.length) {
      lineas.push(linea);
      linea = { palabras: [palabra], ancho: palabra.ancho, forzada: false };
    } else {
      linea.palabras.push(palabra);
      linea.ancho = anchoConEsta;
    }
  }

  linea.forzada = true; // la última línea de un párrafo no se justifica
  lineas.push(linea);
  return { lineas: lineas.filter((l) => l.palabras.length), espacio };
}

function dibujarLinea(pdf, linea, x, y, anchoMax, espacio, alineacion) {
  let extra = 0;
  if (alineacion === "justificar" && !linea.forzada && linea.palabras.length > 1) {
    extra = (anchoMax - linea.ancho) / (linea.palabras.length - 1);
  }
  if (alineacion === "centro") {
    x += (anchoMax - linea.ancho) / 2;
  }

  for (const palabra of linea.palabras) {
    let xParte = x;
    for (const parte of palabra.partes) {
      pdf.setFont(FUENTE, parte.estilo);
      pdf.text(parte.texto, xParte, y);
      xParte += pdf.getTextWidth(parte.texto);
    }
    x += palabra.ancho + espacio + extra;
  }
}

// ---------- Función principal ----------
export async function exportarPDF(documento, titulo) {
  const fuentes = await prepararTodo();
  const { jsPDF } = window.jspdf;

  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  for (const [estilo, base64] of fuentes) {
    const archivo = `${FUENTE}-${estilo}.ttf`;
    pdf.addFileToVFS(archivo, base64);
    pdf.addFont(archivo, FUENTE, estilo);
  }

  pdf.setProperties({ title: titulo, creator: "Drafty" });
  pdf.setTextColor(27, 35, 51);

  let y = MARGEN.arriba;
  const limite = PAGINA.alto - MARGEN.abajo;

  const nuevaPagina = () => {
    pdf.addPage();
    y = MARGEN.arriba;
  };

  const bloques = leerBloques(documento);

  bloques.forEach((bloque, i) => {
    if (bloque.tipo === "hr") {
      y += 6;
      pdf.setDrawColor(200, 205, 215);
      pdf.line(MARGEN.lados, y, PAGINA.ancho - MARGEN.lados, y);
      y += 14;
      return;
    }

    const esTitulo = bloque.tipo === "h1";
    const esSubtitulo = bloque.tipo === "h2";
    const tam = esTitulo ? TAM.h1 : esSubtitulo ? TAM.h2 : TAM.cuerpo;
    const alto = tam * INTERLINEA;

    // Los títulos van en mayúsculas, como en pantalla
    const trozos = esTitulo || esSubtitulo
      ? bloque.trozos.map((t) => ({ ...t, texto: t.texto.toLocaleUpperCase("es") }))
      : bloque.trozos;

    const sangria = bloque.tipo === "li" ? 18 : 0;
    const anchoMax = ANCHO_UTIL - sangria;
    const { lineas, espacio } = armarLineas(pdf, partirEnPalabras(trozos), anchoMax, tam);

    // Espacio antes del bloque
    if (esSubtitulo && i > 0) y += 10;

    // Un subtítulo nunca se queda solo al final de la página
    const minimo = esSubtitulo ? alto * 3 : alto;
    if (y + minimo > limite) nuevaPagina();

    if (bloque.tipo === "li") {
      pdf.setFont(FUENTE, "normal");
      pdf.setFontSize(tam);
      pdf.text(bloque.marca, MARGEN.lados + 4, y + tam);
    }

    const alineacion = esTitulo ? "centro" : esSubtitulo ? "izquierda" : "justificar";

    for (const linea of lineas) {
      if (y + alto > limite) nuevaPagina();
      pdf.setFontSize(tam);
      dibujarLinea(pdf, linea, MARGEN.lados + sangria, y + tam, anchoMax, espacio, alineacion);
      y += alto;
    }

    // Espacio después del bloque
    y += esTitulo ? 18 : esSubtitulo ? 2 : bloque.tipo === "li" ? 2 : 8;
  });

  // Número de página en cada hoja
  const total = pdf.getNumberOfPages();
  for (let n = 1; n <= total; n++) {
    pdf.setPage(n);
    pdf.setFont(FUENTE, "normal");
    pdf.setFontSize(TAM.pie);
    pdf.setTextColor(122, 131, 150);
    const texto = `Página ${n} de ${total}`;
    pdf.text(texto, PAGINA.ancho / 2 - pdf.getTextWidth(texto) / 2, PAGINA.alto - 36);
  }

  pdf.save(nombreArchivo(titulo));
}

function nombreArchivo(titulo) {
  const limpio = (titulo || "Contrato")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return `${limpio || "Contrato"}.pdf`;
}
