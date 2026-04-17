/**
 * SERVIDOR - Lógica de Backend EDC
 * Versión 3.1 - Login + Panel Buzo + Documentos Automáticos en Drive + Enrutador SATT
 */

const SHEET_ID = "1F44HtreRwgyJKvW9dbbibuPDr50Je2Q6OAQ8z3aGVAM";
// Eliminamos DRIVE_FOLDER_ID estático porque ahora el sistema crea las carpetas solo.

// ----------------------------------------------------
// 1. EL ENRUTADOR PRINCIPAL
// ----------------------------------------------------
function doGet(e) {
  try {
    const pagina = e && e.parameter && e.parameter.pagina;
    
    // MAPEO DE SEGURIDAD
    const paginas = {
      'registro':   'index',      // Pantalla de registro
      'panel':      'panel',      // Panel del Sindicato
      'buzo_panel': 'buzo_panel', // Panel del Buzo
      'login':      'login',      // Pantalla de Login
      'satt':       'satt'        // EL NUEVO SISTEMA SATT
    };

    const archivo = paginas[pagina] || 'login';

    return HtmlService.createTemplateFromFile(archivo)
      .evaluate()
      .setTitle("EDC - Sindicato ABP")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput("Error Crítico de Enrutamiento: " + err.message);
  }
}


// ----------------------------------------------------
// 2. LA NUEVA LÓGICA DE DRIVE (Carpetas Inteligentes)
// ----------------------------------------------------
function guardarDocumentoEnDrive(objArchivo) {
  try {
    // 1. Busca o crea la carpeta principal del EDC
    let carpetasPrincipales = DriveApp.getFoldersByName("EDC_Documentos_Buzos");
    let carpetaPrincipal = carpetasPrincipales.hasNext() ? carpetasPrincipales.next() : DriveApp.createFolder("EDC_Documentos_Buzos");

    // 2. Busca o crea la carpeta individual del buzo (Nombre - Libreta)
    let nombreCarpetaBuzo = objArchivo.nombreBuzo + " - " + objArchivo.libreta;
    let carpetasBuzo = carpetaPrincipal.getFoldersByName(nombreCarpetaBuzo);
    let carpetaBuzo = carpetasBuzo.hasNext() ? carpetasBuzo.next() : carpetaPrincipal.createFolder(nombreCarpetaBuzo);

    // 3. Reconstruye y guarda el PDF/Imagen
    let data = Utilities.base64Decode(objArchivo.base64);
    let nombreFinal = objArchivo.tipoDoc + " - " + objArchivo.nombreArchivo; 
    let blob = Utilities.newBlob(data, objArchivo.mimeType, nombreFinal);
    
    let archivoGuardado = carpetaBuzo.createFile(blob);
    
    return { 
      exito: true, 
      mensaje: "Guardado en carpeta: " + nombreCarpetaBuzo,
      url: archivoGuardado.getUrl()
    };

  } catch (error) {
    return { exito: false, mensaje: "Error de Drive: " + error.toString() };
  }
}

// (Opcional) Mantenemos la tuya vieja por si hay código legacy que la llama, 
// pero te sugiero ir migrando todo a guardarDocumentoEnDrive.
function subirDocumento(dni, tipo, nombreArchivo, base64) {
  return { ok: false, msg: "⚠️ Esta función fue reemplazada. Actualizar el código frontend." };
}


// ----------------------------------------------------
// 3. TU LÓGICA ORIGINAL DE BASE DE DATOS (Intacta)
// ----------------------------------------------------

function registrarBuzo(datos) {
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const hoja = ss.getSheetByName("DB_BUZOS");
  if (!hoja) return { ok: false, msg: "Error: No encontré la pestaña 'DB_BUZOS'." };

  const dniIngresado     = String(datos.dni).trim();
  const libretaIngresada = String(datos.libreta).trim();

  const dniCol = hoja.getRange("D:D").getValues().flat();
  if (dniCol.slice(1).map(String).includes(dniIngresado)) {
    return { ok: false, msg: "⚠️ El DNI " + dniIngresado + " ya está registrado. Contactá a ABP." };
  }

  const libretaCol = hoja.getRange("E:E").getValues().flat();
  if (libretaCol.slice(1).map(String).filter(v => v).includes(libretaIngresada)) {
    return { ok: false, msg: "⚠️ La Libreta N° " + libretaIngresada + " ya está registrada. Contactá a ABP." };
  }

  hoja.appendRow([
    new Date(),
    datos.nombre,
    datos.apellido,
    dniIngresado,
    libretaIngresada,
    datos.email,
    datos.celular,
    "PENDIENTE"
  ]);

  const urlLogin = ScriptApp.getService().getUrl() + '?pagina=login';
  
  try {
    enviarEmailBienvenida(datos.email, datos.nombre, urlLogin);
  } catch(e) {
    // Falla silente del correo
  }

  return { 
    ok: true, 
    msg: "✅ Registro exitoso. Te enviamos un email. Tu estado es PENDIENTE hasta validación.",
    urlLogin: urlLogin
  };
}

function loginBuzo(email, dni, libreta) {
  try {
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName("DB_BUZOS");
    if (!hoja) return { ok: false, msg: "Error interno." };

    const datos = hoja.getDataRange().getValues();

    for (let i = 1; i < datos.length; i++) {
      const emailHoja   = String(datos[i][5]).trim().toLowerCase();
      const dniHoja     = String(datos[i][3]).trim();
      const libretaHoja = String(datos[i][4]).trim().toLowerCase();

      if (
        emailHoja   === email.trim().toLowerCase() &&
        dniHoja     === String(dni).trim() &&
        libretaHoja === libreta.trim().toLowerCase()
      ) {
        return {
          ok:       true,
          fila:     i + 1,
          nombre:   datos[i][1],
          apellido: datos[i][2],
          dni:      datos[i][3],
          libreta:  datos[i][4],
          email:    datos[i][5],
          celular:  datos[i][6],
          estado:   datos[i][7]
        };
      }
    }
    return { ok: false, msg: "⚠️ Los datos no coinciden. Verificá email, DNI y N° de libreta." };

  } catch(e) {
    return { ok: false, msg: "Error: " + e.message };
  }
}

function obtenerBuzos() {
  try {
    const ss   = SpreadsheetApp.openById(SHEET_ID);
    const hoja = ss.getSheetByName("DB_BUZOS");
    if (!hoja) return { error: "No se encontró la hoja DB_BUZOS" };

    const lastRow = hoja.getLastRow();
    if (lastRow < 2) return [];

    const datos = hoja.getRange(1, 1, lastRow, 8).getValues();
    const buzos = [];

    for (let i = 1; i < datos.length; i++) {
      if (!datos[i][1]) continue;
      buzos.push({
        fila:      i + 1,
        timestamp: datos[i][0] ? new Date(datos[i][0]).toISOString() : '',
        nombre:    datos[i][1] || '',
        apellido:  datos[i][2] || '',
        dni:       datos[i][3] || '',
        libreta:   datos[i][4] || '',
        email:     datos[i][5] || '',
        celular:   datos[i][6] || '',
        estado:    datos[i][7] || 'PENDIENTE'
      });
    }
    return buzos;

  } catch(e) {
    return { error: e.message };
  }
}

function cambiarEstado(fila, nuevoEstado) {
  const ss   = SpreadsheetApp.openById(SHEET_ID);
  const hoja = ss.getSheetByName("DB_BUZOS");
  if (!hoja) return "Error: hoja no encontrada.";
  hoja.getRange(fila, 8).setValue(nuevoEstado);
  return "Estado actualizado a: " + nuevoEstado;
}

// ----------------------------------------------------
// 4. FUNCIONES DE UTILIDAD (Urls y Correos)
// ----------------------------------------------------

function getLoginUrl() {
  return ScriptApp.getService().getUrl() + '?pagina=login';
}

function getPanelUrl() {
  return ScriptApp.getService().getUrl() + '?pagina=buzo_panel';
}

function getRegistroUrl() {
  return ScriptApp.getService().getUrl() + '?pagina=registro';
}

function enviarEmailBienvenida(email, nombre, urlLogin) {
  const asunto = "⚓ Registro EDC confirmado — Sindicato ABP";
  const cuerpo = `Hola ${nombre},\n\nTu registro en el Ecosistema Digital de Certificaciones (EDC) fue recibido correctamente.\n\nTu perfil está en estado PENDIENTE hasta que ABP valide tu documentación.\n\nPara ingresar a tu panel usá este link:\n${urlLogin}\n\nRecordá que para entrar necesitás:\n- Tu email: ${email}\n- Tu DNI\n- Tu N° de Libreta\n\nSindicato ABP — Sistema EDC`;
  GmailApp.sendEmail(email, asunto, cuerpo);
}

// --- FUNCIONES SATT (AÑADIR A CODIGO.GS) ---

// Simulación de búsqueda de trabajos (Hasta que armemos la pestaña "Trabajos_Activos")
function obtenerTrabajosAsignados(libreta) {
  // TODO: Conectar con la Google Sheet real. 
  // Por ahora devolvemos un dato de prueba simulando que este buzo fue seleccionado.
  return [
    {
      id: "TRB-104",
      empresa: "Marítima del Sur S.A.",
      urgente: true,
      etiquetas: "Saturación, Corte y Soldadura",
      vencimiento: "Hoy, 18:00 hs"
    }
  ];
}

// Procesa el clic en "Aceptar" o "Rechazar"
function procesarRespuestaBuzo(libreta, idTrabajo, respuesta) {
  // TODO: Escribir la respuesta en la base de datos real.
  // TODO: Si es NO, disparar el mail al buzo suplente (#6).
  return { ok: true, msg: "Respuesta registrada." };
}
