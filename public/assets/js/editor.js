// =========================================================
// Barra de edición con IA
// Cuando el usuario selecciona texto dentro del contrato aparece
// una barra flotante. Al elegir una acción, el fragmento se manda
// a /api/refine y se reemplaza en el mismo lugar.
// =========================================================

import { refinarTexto } from "./api.js";
import { formatoEnLinea } from "./markdown.js";

export function iniciarBarraIA({ documento, barra, obtenerContexto, alCambiar, alError }) {
  let rangoGuardado = null;
  let ocupado = false;

  // ---------- Mostrar / ocultar ----------
  function seleccionValida() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;

    const rango = sel.getRangeAt(0);
    if (!documento.contains(rango.commonAncestorContainer)) return null;
    if (documento.getAttribute("contenteditable") !== "true") return null;
    if (sel.toString().trim().length < 3) return null;

    return rango;
  }

  function posicionar(rango) {
    const caja = rango.getBoundingClientRect();
    barra.hidden = false;

    const ancho = barra.offsetWidth;
    const alto = barra.offsetHeight;
    const margen = 10;

    let izquierda = caja.left + caja.width / 2 - ancho / 2;
    izquierda = Math.max(margen, Math.min(izquierda, window.innerWidth - ancho - margen));

    // Arriba de la selección; si no cabe, abajo
    let arriba = caja.top - alto - margen;
    if (arriba < 70) arriba = caja.bottom + margen;

    barra.style.left = `${izquierda}px`;
    barra.style.top = `${arriba}px`;
  }

  function revisarSeleccion() {
    if (ocupado) return;
    const rango = seleccionValida();
    if (rango) {
      posicionar(rango);
    } else {
      barra.hidden = true;
    }
  }

  document.addEventListener("selectionchange", () => {
    // Pequeña espera para no recalcular en cada milisegundo del arrastre
    clearTimeout(revisarSeleccion.timer);
    revisarSeleccion.timer = setTimeout(revisarSeleccion, 120);
  });

  window.addEventListener("scroll", () => !ocupado && (barra.hidden = true), true);
  window.addEventListener("resize", () => !ocupado && (barra.hidden = true));

  // Evita que al hacer clic en la barra se pierda la selección
  barra.addEventListener("mousedown", (e) => e.preventDefault());

  // ---------- Ejecutar una acción ----------
  barra.addEventListener("click", async (e) => {
    const boton = e.target.closest("button[data-action]");
    if (!boton || ocupado) return;

    const rango = seleccionValida();
    if (!rango) return;

    rangoGuardado = rango.cloneRange();
    const textoOriginal = window.getSelection().toString();

    ocupado = true;
    barra.classList.add("is-busy");
    boton.classList.add("is-loading");
    documento.setAttribute("contenteditable", "false");
    documento.classList.add("is-refining");

    try {
      const nuevo = await refinarTexto({
        accion: boton.dataset.action,
        texto: textoOriginal,
        contexto: obtenerContexto()
      });

      reemplazar(rangoGuardado, nuevo);
      alCambiar();
    } catch (err) {
      alError(err.message);
    } finally {
      ocupado = false;
      barra.classList.remove("is-busy");
      boton.classList.remove("is-loading");
      barra.hidden = true;
      documento.setAttribute("contenteditable", "true");
      documento.classList.remove("is-refining");
      window.getSelection().removeAllRanges();
    }
  });

  // Inserta el texto nuevo donde estaba la selección y lo
  // resalta un momento para que el usuario vea qué cambió.
  function reemplazar(rango, texto) {
    const marca = document.createElement("span");
    marca.className = "ai-updated";
    marca.innerHTML = texto
      .split(/\n{2,}/)
      .map((bloque) => bloque.split("\n").map(formatoEnLinea).join("<br>"))
      .join("<br><br>");

    rango.deleteContents();
    rango.insertNode(marca);

    setTimeout(() => {
      // Quita el resaltado pero deja el contenido
      marca.replaceWith(...marca.childNodes);
      documento.normalize();
      alCambiar();
    }, 2200);
  }
}
