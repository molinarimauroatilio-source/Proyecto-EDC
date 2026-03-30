/**
 * SERVIDOR - Lógica de Backend EDC
 * Versión 3.0 - Login + Panel Buzo + Documentos
 */

const SHEET_ID = "1F44HtreRwgyJKvW9dbbibuPDr50Je2Q6OAQ8z3aGVAM";
const DRIVE_FOLDER_ID = "1L7E8cCE9ENbS5kIjARpKipsk4KbfLP0c";

function doGet(e) {
  try {
    const pagina = e && e.parameter && e.parameter.pagina;
    
    // MAPEO DE SEGURIDAD: 
    // La palabra de la izquierda es la que va en la URL (?pagina=...)
    // La palabra de la derecha es EL NOMBRE EXACTO DEL ARCHIVO en tu editor.
    const paginas = {
      'registro':   'index',      // Asegurate que tu archivo se llame 'index'
      'panel':      'panel',      // Asegurate que tu archivo se llame 'panel'
      'buzo_panel': 'buzo_panel', // Asegurate que tu archivo se llame 'buzo_panel'
      'login':      'login'       // Asegurate que tu archivo se llame 'login'
    };

    const archivo = paginas[pagina] || 'login';

    return HtmlService.createTemplateFromFile(archivo)
      .evaluate()
      .setTitle("EDC - Sindicato ABP")
      .addMetaTag('viewport', 'width=device-width, initial-scale=1')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput("Error Crítico: " + err.message);
  }
}

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
    // Si falla el email, igual confirmamos el registro
  }

return { 
    ok: true, 
    msg: "✅ Registro exitoso. Te enviamos un email con el link para ingresar. Tu estado es PENDIENTE hasta que ABP lo valide.",
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

function subirDocumento(dni, tipo, nombreArchivo, base64) {
  try {
    if (!DRIVE_FOLDER_ID) return { ok: false, msg: "Carpeta de Drive no configurada aún." };
    
    const carpetaRaiz = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    let carpetaBuzo;
    const carpetas = carpetaRaiz.getFoldersByName('DNI_' + dni);
    carpetaBuzo = carpetas.hasNext() ? carpetas.next() : carpetaRaiz.createFolder('DNI_' + dni);

    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64),
      MimeType.JPEG,
      tipo + '_' + nombreArchivo
    );
    carpetaBuzo.createFile(blob);
    return { ok: true };

  } catch(e) {
    return { ok: false, msg: e.message };
  }
}

function getLoginUrl() {
  return ScriptApp.getService().getUrl() + '?pagina=login';
}

function getPanelUrl() {
  return ScriptApp.getService().getUrl() + '?pagina=buzo_panel';
}

function enviarEmailBienvenida(email, nombre, urlLogin) {
  const asunto = "⚓ Registro EDC confirmado — Sindicato ABP";
  const cuerpo = `
Hola ${nombre},

Tu registro en el Ecosistema Digital de Certificaciones (EDC) fue recibido correctamente.

Tu perfil está en estado PENDIENTE hasta que ABP valide tu documentación.

Para ingresar a tu panel usá este link:
${urlLogin}

Recordá que para entrar necesitás:
- Tu email: ${email}
- Tu DNI
- Tu N° de Libreta

Sindicato ABP — Sistema EDC
  `;
  GmailApp.sendEmail(email, asunto, cuerpo);
}

function getRegistroUrl() {
  return ScriptApp.getService().getUrl() + '?pagina=registro';
}
