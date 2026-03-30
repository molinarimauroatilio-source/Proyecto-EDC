/**
 * SERVIDOR - Lógica de Backend EDC
 * Versión 2.0 - Con deduplicación y panel admin
 */

function doGet(e) {
  const pagina = e && e.parameter && e.parameter.pagina;
  
  if (pagina === 'panel') {
    return HtmlService.createTemplateFromFile('panel')
      .evaluate()
      .setTitle("Panel ABP - Gestión de Buzos")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle("Registro EDC - Buzos")
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function registrarBuzo(datos) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("DB_BUZOS");

  if (!hoja) return { ok: false, msg: "Error: No encontré la pestaña 'DB_BUZOS'." };

  // VALIDACIÓN: DNI duplicado
  const dniCol = hoja.getRange("D:D").getValues().flat();
  const dniIngresado = String(datos.dni).trim();
  
  if (dniCol.slice(1).map(String).includes(dniIngresado)) {
    return { 
      ok: false, 
      msg: "⚠️ El DNI " + dniIngresado + " ya está registrado en el sistema. Si crees que es un error, contactá a ABP." 
    };
  }

  // VALIDACIÓN: Libreta duplicada
  const libretaCol = hoja.getRange("E:E").getValues().flat();
  const libretaIngresada = String(datos.libreta).trim();
  
  if (libretaCol.slice(1).map(String).filter(v => v).includes(libretaIngresada)) {
    return { 
      ok: false, 
      msg: "⚠️ La Libreta N° " + libretaIngresada + " ya está registrada. Contactá a ABP." 
    };
  }

  hoja.appendRow([
    new Date(),        // A: Timestamp
    datos.nombre,      // B: Nombre
    datos.apellido,    // C: Apellido
    dniIngresado,      // D: DNI
    libretaIngresada,  // E: Libreta N°
    datos.email,       // F: Email
    datos.celular,     // G: Celular
    "PENDIENTE"        // H: Estado
  ]);

  return { ok: true, msg: "✅ Registro exitoso. Tu estado es PENDIENTE hasta que ABP lo valide." };
}

// PANEL: Devuelve todos los buzos para el panel del Sindicato
function obtenerBuzos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("DB_BUZOS");
  if (!hoja) return [];

  const datos = hoja.getDataRange().getValues();
  const buzos = [];
  
  for (let i = 1; i < datos.length; i++) {
    buzos.push({
      fila: i + 1,
      timestamp: datos[i][0],
      nombre: datos[i][1],
      apellido: datos[i][2],
      dni: datos[i][3],
      libreta: datos[i][4],
      email: datos[i][5],
      celular: datos[i][6],
      estado: datos[i][7]
    });
  }
  return buzos;
}

// PANEL: Cambia el estado de un buzo
function cambiarEstado(fila, nuevoEstado) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hoja = ss.getSheetByName("DB_BUZOS");
  if (!hoja) return "Error: hoja no encontrada.";
  
  hoja.getRange(fila, 8).setValue(nuevoEstado); // Columna H = Estado
  return "Estado actualizado a: " + nuevoEstado;
}
