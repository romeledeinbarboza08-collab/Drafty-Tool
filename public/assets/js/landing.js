// =========================================================
// Drafty - Landing
// Maneja el cuadro del prompt, los tipos de contrato
// y la demo de edición con IA.
// =========================================================

const MAX_CHARS = 2000;

// Ejemplos de placeholder para cada tipo, así el usuario
// ve qué tipo de información conviene escribir.
const EJEMPLOS = {
  servicios: "Ej: Contrato de diseño web entre mi empresa Café Brisa S.A. y la diseñadora Laura Mora. Pago de ₡450 000 en dos partes, entrega en 30 días.",
  pago: "Ej: Acuerdo de pago entre Carlos Vega y yo por un préstamo de $1 200, en 6 cuotas mensuales a partir de noviembre.",
  nda: "Ej: NDA entre mi startup Nodo Labs y un desarrollador freelance que va a ver el código de nuestra app. Vigencia de 2 años.",
  mantenimiento: "Ej: Mantenimiento mensual de aires acondicionados para la Clínica San Rafael, 2 visitas al mes, ₡120 000 mensuales.",
  contratista: "Ej: Contrato con un fotógrafo independiente para cubrir 4 eventos de la empresa. Pago por evento de $250, él pone su equipo.",
  personalizado: "Ej: Acuerdo entre tres amigos para compartir los gastos y el uso de un local de ensayo de música."
};

const form = document.getElementById("prompt-form");
const textarea = document.getElementById("prompt");
const counter = document.getElementById("counter");
const generateBtn = document.getElementById("generate-btn");
const chips = document.querySelectorAll(".chip");

let tipoActual = "servicios";

// ---------- Selección de tipo ----------
function seleccionarTipo(tipo) {
  tipoActual = tipo;

  chips.forEach((chip) => {
    chip.setAttribute("aria-pressed", chip.dataset.type === tipo ? "true" : "false");
  });

  textarea.placeholder = EJEMPLOS[tipo];
}

chips.forEach((chip) => {
  chip.addEventListener("click", () => seleccionarTipo(chip.dataset.type));
});

// Las tarjetas de la sección "Tipos" seleccionan el tipo
// y llevan al usuario de vuelta al cuadro del prompt.
document.querySelectorAll(".type-card").forEach((card) => {
  card.addEventListener("click", () => {
    seleccionarTipo(card.dataset.type);
    document.getElementById("crear").scrollIntoView({ behavior: "smooth" });
    setTimeout(() => textarea.focus({ preventScroll: true }), 450);
  });
});

// ---------- Contador y validación ----------
function actualizarEstado() {
  const largo = textarea.value.length;
  const texto = textarea.value.trim();

  counter.textContent = `${largo} / ${MAX_CHARS}`;
  counter.classList.toggle("is-over", largo >= MAX_CHARS);

  // El botón solo se activa si hay algo escrito con sentido
  generateBtn.disabled = texto.length < 10;
}

textarea.addEventListener("input", actualizarEstado);

// Ctrl + Enter también envía, como en muchas apps de IA
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !generateBtn.disabled) {
    form.requestSubmit();
  }
});

// ---------- Envío ----------
// El landing no llama a la IA directamente. Guarda la solicitud
// y abre el editor, que es quien genera el contrato.
form.addEventListener("submit", (e) => {
  e.preventDefault();

  const descripcion = textarea.value.trim();
  if (descripcion.length < 10) return;

  sessionStorage.setItem(
    "drafty:pendiente",
    JSON.stringify({ tipo: tipoActual, descripcion })
  );

  window.location.href = "/app.html";
});

// ---------- Demo de edición con IA ----------
// Textos de ejemplo fijos: aquí solo mostramos cómo funciona,
// la IA real se usa dentro del editor.
const DEMO = {
  original: "El cliente le va a pagar al proveedor la plata en dos partes, una al principio y otra cuando se termine el trabajo.",
  mejorar: "El Cliente pagará al Proveedor el monto total acordado en dos tractos: el cincuenta por ciento (50 %) a la firma del presente contrato y el saldo restante contra la entrega final y aceptación del trabajo.",
  acortar: "El Cliente pagará en dos tractos: 50 % a la firma y 50 % contra entrega.",
  alargar: "El Cliente pagará al Proveedor el monto total acordado en dos tractos iguales. El primero se cancelará dentro de los tres (3) días hábiles siguientes a la firma del presente contrato, y el segundo dentro de los cinco (5) días hábiles posteriores a la entrega final y aceptación por escrito del trabajo. Los pagos se realizarán mediante transferencia bancaria a la cuenta que indique el Proveedor.",
  corregir: "El cliente le pagará al proveedor el monto en dos partes: una al inicio y otra cuando se termine el trabajo."
};

const demoText = document.getElementById("demo-text");
const demoNote = document.getElementById("demo-note");
const tabs = document.querySelectorAll(".ai-action");
const toolbarItems = document.querySelectorAll(".doc-toolbar span");

let demoTimer;

function mostrarDemo(accion) {
  tabs.forEach((tab) => {
    tab.setAttribute("aria-selected", tab.dataset.action === accion ? "true" : "false");
  });
  toolbarItems.forEach((item) => {
    item.classList.toggle("is-active", item.dataset.for === accion);
  });

  // Primero se ve el texto original seleccionado,
  // y después de un momento aparece la versión mejorada.
  clearTimeout(demoTimer);
  demoText.textContent = DEMO.original;
  demoText.classList.remove("is-done");
  demoNote.hidden = true;

  demoTimer = setTimeout(() => {
    demoText.textContent = DEMO[accion];
    demoText.classList.add("is-done");
    demoNote.hidden = false;
  }, 700);
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => mostrarDemo(tab.dataset.action));
});

mostrarDemo("mejorar");
actualizarEstado();
