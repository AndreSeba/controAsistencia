const ExcelJS = require('exceljs');

// columnas: [{ header, key, width }], filas: [{ [key]: valor }]
async function generarBuffer(nombreHoja, columnas, filas) {
  const workbook = new ExcelJS.Workbook();
  const hoja = workbook.addWorksheet(nombreHoja);
  hoja.columns = columnas;
  hoja.addRows(filas);
  hoja.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

module.exports = { generarBuffer };
