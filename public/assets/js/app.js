// =========================================================
// Drafty - Editor (app.html)
// Coordina todo: generar contratos, mostrarlos, guardarlos,
// la lista lateral, copiar y descargar en PDF.
// =========================================================

import { generarContrato } from "./api.js";
import { markdownAHtml } from "./markdown.js";
import { iniciarBarraIA } from "./editor.js";
import { exportarPDF } from "./pdf.js";
import {
  listarContratos,
  obtenerContrato,
  crearContrato,
  actualizarContrato,
  eliminarContrato
} from "./storage.js";

const NOMBRES_TIPO = {
  servicios: "Servicios",
  pago: "Pago",
  nda: "Confidencialidad",
  mantenimiento: "Mantenimiento",
  contratista: "Contratista",
  personalizado: "Personalizado"
};

const EJEMPLOS = {
  servicios: "Ej: Contrato de diseño web entre mi empresa Café Brisa S.A. y la diseñadora Laura Mora. Pago de ₡450 000 en dos partes, entrega en 30 días.",
  pago: "Ej: Acuerdo de pago entre Carlos Vega y yo por un préstamo de $1 200, en 6 cuotas mensuales a partir de noviembre.",
  nda: "Ej: NDA entre mi startup Nodo Labs y un desarrollador freelance que va a ver el código de nuestra app. Vigencia de 2 años.",
  mantenimiento: "Ej: Mantenimiento mensual de aires acondicionados para la Clínica San Rafael, 2 visitas al mes, ₡120 000 mensuales.",
  contratista: "Ej: Contrato con un fotógrafo independiente para cubrir 4 eventos de la empresa. Pago por evento de $250, él pone su equipo.",
  personalizado: "Ej: Acuerdo entre tres amigos para compartir los gastos y el uso de un local de ensayo de música."
};

// ---------- Elementos ----------
const $ = (id) => document.getElementById(id);

const vistaNuevo = $("view-new");
const vistaDoc = $("view-doc");
const vistaError = $("view-error");
const documento = $("doc");
const estadoGen = $("gen-status");
const tituloInput = $("doc-title");
const estadoGuardado = $("save-status");
const lista = $("contract-list");
const listaVacia = $("list-empty");
const contador = $("list-count");
const sidebar = $("sidebar");

const form = $("new-form");
const textarea = $("new-prompt");
const botonGenerar = $("new-generate");
const chips = form.querySelectorAll(".chip");

// ---------- Estado ----------
let actual = null;          // contrato abierto
let generando = false;
let ultimaSolicitud = null; // para "Intentar de nuevo"
let tipoNuevo = "servicios";
let timerGuardado;

// =========================================================
// Vistas
// =========================================================
function mostrarVista(nombre) {
  vistaNuevo.hidden = nombre !== "nuevo";
  vistaDoc.hidden = nombre !== "doc";
  vistaError.hidden = nombre !== "error";
  document.body.dataset.vista = nombre;
}

function abrirNuevo() {
  if (generando) return;
  actual = null;
  tituloInput.value = "";
  tituloInput.disabled = true;
  estadoGuardado.textContent = "";
  history.replaceState(null, "", "/app.html");
  mostrarVista("nuevo");
  renderLista();
  cerrarSidebar();
  textarea.focus();
}

function abrirContrato(id) {
  if (generando) return;
  const contrato = obtenerContrato(id);
  if (!contrato) return abrirNuevo();

  actual = contrato;
  tituloInput.value = contrato.titulo;
  tituloInput.disabled = false;
  documento.innerHTML = contrato.html;
  documento.setAttribute("contenteditable", "true");
  estadoGen.hidden = true;
  estadoGuardado.textContent = "Guardado";

  history.replaceState(null, "", `/app.html?id=${contrato.id}`);
  mostrarVista("doc");
  renderLista();
  cerrarSidebar();
  window.scrollTo(0, 0);
}

function mostrarError(mensaje) {
  $("error-message").textContent = mensaje;
  mostrarVista("error");
}

// =========================================================
// Generación
// =========================================================
async function generar(tipo, descripcion) {
  generando = true;
  ultimaSolicitud = { tipo, descripcion };
  actual = null;

  document.body.classList.add("is-generating");
  tituloInput.value = "Generando contrato…";
  tituloInput.disabled = true;
  estadoGuardado.textContent = "";
  documento.innerHTML = "";
  documento.setAttribute("contenteditable", "false");
  documento.classList.add("is-streaming");
  estadoGen.hidden = false;
  mostrarVista("doc");

  // Se actualiza la pantalla como máximo una vez por cuadro,
  // aunque lleguen muchos pedazos de texto muy seguido.
  let pendiente = null;
  const pintar = (texto) => {
    pendiente = texto;
    requestAnimationFrame(() => {
      if (pendiente === null) return;
      documento.innerHTML = markdownAHtml(pendiente);
      pendiente = null;
    });
  };

  try {
    const markdown = await generarContrato({ tipo, descripcion }, pintar);
    documento.innerHTML = markdownAHtml(markdown);

    actual = crearContrato({
      titulo: tituloDesde(documento),
      tipo,
      html: documento.innerHTML
    });

    tituloInput.value = actual.titulo;
    tituloInput.disabled = false;
    documento.setAttribute("contenteditable", "true");
    estadoGuardado.textContent = "Guardado";
    history.replaceState(null, "", `/app.html?id=${actual.id}`);
    renderLista();
    avisar("Contrato listo. Selecciona cualquier texto para editarlo con IA.");
  } catch (err) {
    mostrarError(err.message);
    tituloInput.value = "";
  } finally {
    generando = false;
    estadoGen.hidden = true;
    documento.classList.remove("is-streaming");
    document.body.classList.remove("is-generating");
  }
}

// "CONTRATO DE PRESTACIÓN DE SERVICIOS" -> "Contrato de prestación de servicios"
function tituloDesde(doc) {
  const h1 = doc.querySelector("h1");
  const texto = (h1?.textContent || "Contrato sin título").trim();
  const minus = texto.toLocaleLowerCase("es");
  return minus.charAt(0).toLocaleUpperCase("es") + minus.slice(1);
}

// =========================================================
// Guardado automático
// =========================================================
function programarGuardado() {
  if (!actual) return;
  estadoGuardado.textContent = "Guardando…";
  clearTimeout(timerGuardado);
  timerGuardado = setTimeout(guardarAhora, 600);
}

function guardarAhora() {
  if (!actual) return;
  const ok = actualizarContrato(actual.id, {
    titulo: tituloInput.value.trim() || "Contrato sin título",
    html: documento.innerHTML
  });
  estadoGuardado.textContent = ok ? "Guardado" : "No se pudo guardar";
  renderLista();
}

documento.addEventListener("input", programarGuardado);
tituloInput.addEventListener("input", programarGuardado);
tituloInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    tituloInput.blur();
  }
});

// =========================================================
// Lista lateral
// =========================================================
function renderLista() {
  const contratos = listarContratos();
  contador.textContent = contratos.length;
  listaVacia.hidden = contratos.length > 0;

  lista.innerHTML = "";
  for (const c of contratos) {
    const li = document.createElement("li");
    li.className = "contract-item" + (actual?.id === c.id ? " is-active" : "");
    li.innerHTML = `
      <button type="button" class="contract-item__main">
        <span class="contract-item__title"></span>
        <span class="contract-item__meta">
          <span class="contract-item__tag"></span>
          <span class="contract-item__date"></span>
        </span>
      </button>
      <button type="button" class="contract-item__delete" aria-label="Eliminar contrato">
        <svg><use href="#i-trash"/></svg>
      </button>`;

    // textContent en vez de innerHTML para que el título no pueda inyectar HTML
    li.querySelector(".contract-item__title").textContent = c.titulo;
    li.querySelector(".contract-item__tag").textContent = NOMBRES_TIPO[c.tipo] ?? "Contrato";
    li.querySelector(".contract-item__date").textContent = fechaRelativa(c.actualizado);

    li.querySelector(".contract-item__main").addEventListener("click", () => abrirContrato(c.id));
    li.querySelector(".contract-item__delete").addEventListener("click", () => borrar(c));

    lista.appendChild(li);
  }
}

function borrar(contrato) {
  if (!confirm(`¿Eliminar "${contrato.titulo}"? Esta acción no se puede deshacer.`)) return;
  eliminarContrato(contrato.id);
  if (actual?.id === contrato.id) abrirNuevo();
  else renderLista();
  avisar("Contrato eliminado.");
}

function fechaRelativa(ms) {
  const minutos = Math.round((Date.now() - ms) / 60000);
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  return new Date(ms).toLocaleDateString("es", { day: "numeric", month: "short" });
}

// Sidebar en celular
function cerrarSidebar() {
  sidebar.classList.remove("is-open");
}
$("toggle-sidebar").addEventListener("click", () => sidebar.classList.toggle("is-open"));

// =========================================================
// Formulario de nuevo contrato
// =========================================================
function seleccionarTipo(tipo) {
  tipoNuevo = tipo;
  chips.forEach((chip) => chip.setAttribute("aria-pressed", String(chip.dataset.type === tipo)));
  textarea.placeholder = EJEMPLOS[tipo];
}

chips.forEach((chip) => chip.addEventListener("click", () => seleccionarTipo(chip.dataset.type)));

textarea.addEventListener("input", () => {
  $("new-counter").textContent = `${textarea.value.length} / 2000`;
  botonGenerar.disabled = textarea.value.trim().length < 10;
});

textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !botonGenerar.disabled) form.requestSubmit();
});

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const descripcion = textarea.value.trim();
  if (descripcion.length < 10 || generando) return;
  generar(tipoNuevo, descripcion);
  textarea.value = "";
  textarea.dispatchEvent(new Event("input"));
});

// =========================================================
// Acciones de la barra superior
// =========================================================
$("btn-new").addEventListener("click", abrirNuevo);
$("btn-new-side").addEventListener("click", abrirNuevo);

$("btn-copy").addEventListener("click", async () => {
  if (!actual) return;
  try {
    await navigator.clipboard.writeText(documento.innerText);
    avisar("Texto copiado al portapapeles.");
  } catch {
    avisar("No se pudo copiar. Selecciona el texto y usa Ctrl + C.");
  }
});

$("btn-pdf").addEventListener("click", async () => {
  if (!actual) return;
  const boton = $("btn-pdf");
  const etiqueta = boton.querySelector("span");

  guardarAhora();
  boton.disabled = true;
  etiqueta.textContent = "Preparando…";

  try {
    await exportarPDF(documento, tituloInput.value.trim() || "Contrato");
    avisar("PDF descargado.");
  } catch (err) {
    console.error(err);
    avisar("No se pudo crear el PDF. Intenta de nuevo.");
  } finally {
    boton.disabled = false;
    etiqueta.textContent = "Descargar PDF";
  }
});

$("btn-retry").addEventListener("click", () => {
  if (ultimaSolicitud) generar(ultimaSolicitud.tipo, ultimaSolicitud.descripcion);
});
$("btn-back").addEventListener("click", abrirNuevo);

// Avisar antes de cerrar la pestaña si se está generando
window.addEventListener("beforeunload", (e) => {
  if (generando) e.preventDefault();
});

// =========================================================
// Avisos (toast)
// =========================================================
let timerAviso;
function avisar(mensaje) {
  const toast = $("toast");
  toast.textContent = mensaje;
  toast.classList.add("is-visible");
  clearTimeout(timerAviso);
  timerAviso = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

// =========================================================
// Barra de IA sobre el documento
// =========================================================
iniciarBarraIA({
  documento,
  barra: $("ai-toolbar"),
  obtenerContexto: () => `${tituloInput.value}\n\n${documento.innerText.slice(0, 1200)}`,
  alCambiar: programarGuardado,
  alError: avisar
});

// =========================================================
// Inicio
// =========================================================
function iniciar() {
  renderLista();
  seleccionarTipo("servicios");

  // 1. ¿Viene una solicitud desde el landing?
  let pendiente = null;
  try {
    pendiente = JSON.parse(sessionStorage.getItem("drafty:pendiente"));
    sessionStorage.removeItem("drafty:pendiente");
  } catch {
    pendiente = null;
  }

  if (pendiente?.descripcion) {
    generar(pendiente.tipo, pendiente.descripcion);
    return;
  }

  // 2. ¿Se pidió un contrato específico en la URL?
  const id = new URLSearchParams(location.search).get("id");
  if (id && obtenerContrato(id)) {
    abrirContrato(id);
    return;
  }

  // 3. Si no, pantalla de nuevo contrato
  abrirNuevo();
}

iniciar();
