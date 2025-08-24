// inicio.js — Manejo del formulario de inicio

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("nameForm");
  const input = document.getElementById("playerName");

  if (!form || !input) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const playerName = input.value.trim();

    if (!playerName) {
      alert("Por favor, escribe tu nombre para comenzar.");
      input.focus();
      return;
    }

    try {
      // Guardar en localStorage
      localStorage.setItem("playerName", playerName);
      // Redirigir a la intro del nivel 1
      window.location.href = "/paginas/intronivel1.html";
    } catch (err) {
      console.error("Error guardando nombre:", err);
      alert("Hubo un problema guardando tu nombre. Intenta de nuevo.");
    }
  });
});
