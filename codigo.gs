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
  
  if (!hoja) return "Error: No se encontró la pestaña DB_BUZOS";

  // Agregamos la fila con los datos del formulario
  hoja.appendRow([
    new Date(), // ID Temporal (Fecha)
    datos.nombre,
    datos.apellido,
    datos.dni,
    datos.email,
    datos.celular,
    "PENDIENTE" // Estado inicial
  ]);
  
  return "Registro exitoso, Mauro. Datos guardados.";
}
