/**
 * SERVIDOR - Lógica de Backend
 */
function doGet() {
  // Esta función "sirve" la página web
  return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle("Registro EDC - Buzos")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function registrarBuzo(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("DB_BUZOS");
  
  if (!hoja) return "Error: No encontré la pestaña 'DB_BUZOS'.";

  // EL NUEVO ORDEN SEGÚN TU IMAGEN:
  hoja.appendRow([
    new Date(),      // A: Timestamp
    datos.nombre,    // B: Nombre
    datos.apellido,  // C: Apellido
    datos.dni,       // D: DNI
    datos.libreta,   // E: Libreta N° (EL QUE AGREGASTE)
    datos.email,     // F: Email
    datos.celular,   // G: Celular
    "PENDIENTE"      // H: Estado
  ]);
  
  return "¡Éxito! Registro completo con Libreta N° " + datos.libreta;
}
