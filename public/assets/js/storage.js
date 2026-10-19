// =========================================================
// Almacenamiento de contratos
// Drafty no tiene cuentas, así que cada contrato se guarda en
// el navegador del usuario (localStorage). Todo pasa por aquí,
// así que cambiar a una base de datos real sería tocar solo
// este archivo.
// =========================================================

const CLAVE = "drafty:contratos";

function leerTodos() {
  try {
    const data = JSON.parse(localStorage.getItem(CLAVE));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function escribirTodos(contratos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(contratos));
    return true;
  } catch {
    // Puede fallar en modo incógnito o si el almacenamiento está lleno
    return false;
  }
}

// Más recientes primero
export function listarContratos() {
  return leerTodos().sort((a, b) => b.actualizado - a.actualizado);
}

export function obtenerContrato(id) {
  return leerTodos().find((c) => c.id === id) ?? null;
}

export function crearContrato({ titulo, tipo, html }) {
  const ahora = Date.now();
  const contrato = {
    id: generarId(),
    titulo,
    tipo,
    html,
    creado: ahora,
    actualizado: ahora
  };

  const todos = leerTodos();
  todos.push(contrato);
  escribirTodos(todos);
  return contrato;
}

export function actualizarContrato(id, cambios) {
  const todos = leerTodos();
  const indice = todos.findIndex((c) => c.id === id);
  if (indice === -1) return false;

  todos[indice] = { ...todos[indice], ...cambios, actualizado: Date.now() };
  return escribirTodos(todos);
}

export function eliminarContrato(id) {
  return escribirTodos(leerTodos().filter((c) => c.id !== id));
}

function generarId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
