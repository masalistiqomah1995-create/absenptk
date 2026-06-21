// CONFIGURATION GLOBAL INTEGRATION
var SPREADSHEET_ID = "1PGuWCE3ex1Yj7Rf5LsjDYz6kKGvJT-L8BsKXV0GF_ys";
var DRIVE_FOLDER_ID = "1aWORr8uz4QVMbBm0eLjeubtvsHJfNDe5";

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
      .setTitle("Absensi GTK Madrasah Aliyah Al Istiqomah")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// 1. FUNGSI LOGIN MULTI-USER (ANTI-STUCK)
function prosesUserLogin(usernameOrNuptk, password) {
  var inputUser = usernameOrNuptk ? usernameOrNuptk.toString().trim() : "";
  var inputPass = password ? password.toString().trim() : "";
  
  if (inputUser === "" || inputPass === "") {
    return { success: false, message: "Username dan Password tidak boleh kosong!" };
  }

  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetUser = ss.getSheetByName("USER");
    if (!sheetUser) return { success: false, message: "Sistem Error: Tab 'USER' tidak ditemukan!" };
    
    var dataUser = sheetUser.getDataRange().getValues();
    for (var i = 1; i < dataUser.length; i++) {
      if (!dataUser[i][0] || !dataUser[i][1]) continue;
      
      var dbUsername = dataUser[i][0].toString().trim();
      var dbPassword = dataUser[i][1].toString().trim();
      var dbNama     = dataUser[i][2] ? dataUser[i][2].toString().trim() : "User";
      var dbRole     = dataUser[i][3] ? dataUser[i][3].toString().trim().toLowerCase() : "guru";
      
      if (dbUsername === inputUser && dbPassword === inputPass) {
        return { success: true, role: dbRole, nuptk: dbUsername, name: dbNama };
      }
    }
    return { success: false, message: "Username atau Password salah / tidak terdaftar!" };
  } catch (error) {
    return { success: false, message: "Error Server: " + error.message };
  }
}

// 2. SIMPAN ABSENSI GTK
function savePresensi(nuptk, status) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetGTK = ss.getSheetByName("DataGTK");
    var sheetPresensi = ss.getSheetByName("Presensi") || ss.insertSheet("Presensi");
    
    if (sheetPresensi.getLastRow() === 0) {
      sheetPresensi.appendRow(["Timestamp", "Tanggal", "NUPTK", "Nama GTK", "Status Kehadiran"]);
    }
    
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    var namaPegawai = "";
    
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() === targetNuptk) {
          namaPegawai = dataGTK[i][1].toString().trim();
          break;
        }
      }
    }
    
    if (!namaPegawai) {
      var sheetUser = ss.getSheetByName("USER");
      if (sheetUser) {
        var dataUser = sheetUser.getDataRange().getValues();
        for (var k = 1; k < dataUser.length; k++) {
          if (dataUser[k][0] && dataUser[k][0].toString().trim() === targetNuptk) {
            namaPegawai = dataUser[k][2].toString().trim();
            break;
          }
        }
      }
    }
    
    if (!namaPegawai) namaPegawai = "Pegawai (" + targetNuptk + ")";
    
    var now = new Date();
    var formatTanggal = Utilities.formatDate(now, "GMT+7", "yyyy-MM-dd");
    
    var logs = sheetPresensi.getDataRange().getValues();
    for (var j = 1; j < logs.length; j++) {
      if (logs[j][0] && logs[j][2]) {
        var checkTgl = Utilities.formatDate(new Date(logs[j][0]), "GMT+7", "yyyy-MM-dd");
        if (checkTgl === formatTanggal && logs[j][2].toString().trim() === targetNuptk) {
           return { success: false, message: "Anda sudah melakukan presensi hari ini!" };
        }
      }
    }
    
    sheetPresensi.appendRow([now, formatTanggal, targetNuptk, namaPegawai, status]);
    return { success: true, name: namaPegawai };
  } catch (e) {
    return { success: false, message: "Gagal menyimpan: " + e.message };
  }
}

// 3. AMBIL STATISTIK REALTIME
function getRealtimeStatistics() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetGTK = ss.getSheetByName("DataGTK");
    var sheetPresensi = ss.getSheetByName("Presensi");
    
    var totalGTK = sheetGTK ? sheetGTK.getLastRow() - 1 : 0;
    if (totalGTK < 0) totalGTK = 0;
    
    var hadir = 0, izin = 0;
    if (sheetPresensi) {
      var data = sheetPresensi.getDataRange().getValues();
      var todayStr = Utilities.formatDate(new Date(), "GMT+7", "yyyy-MM-dd");
      for (var i = 1; i < data.length; i++) {
        if (data[i][0]) {
          var logDate = Utilities.formatDate(new Date(data[i][0]), "GMT+7", "yyyy-MM-dd");
          if (logDate === todayStr) {
            if (data[i][4] === "Hadir") hadir++;
            else if (data[i][4] === "Izin" || data[i][4] === "Sakit") izin++;
          }
        }
      }
    }
    var alfa = totalGTK - (hadir + izin);
    return { total: totalGTK, hadir: hadir, izin: izin, alfa: alfa < 0 ? 0 : alfa };
  } catch (e) {
    return { total: 0, hadir: 0, izin: 0, alfa: 0 };
  }
}

// 4. RINCIAN ABSENSI PER GTK (PANEL GURU)
function getRincianAbsenPerGtk(nuptk) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetPresensi = ss.getSheetByName("Presensi");
    if (!sheetPresensi) return [];
    
    var logs = sheetPresensi.getDataRange().getValues();
    var list = [];
    var kini = new Date();
    var bulanKini = Utilities.formatDate(kini, "GMT+7", "MM");
    var tahunKini = Utilities.formatDate(kini, "GMT+7", "yyyy");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    
    for (var j = 1; j < logs.length; j++) {
      if (logs[j][2] && logs[j][2].toString().trim() === targetNuptk) {
        var d = new Date(logs[j][0]);
        if (Utilities.formatDate(d, "GMT+7", "MM") === bulanKini && Utilities.formatDate(d, "GMT+7", "yyyy") === tahunKini) {
          list.push({
            tanggal: Utilities.formatDate(d, "GMT+7", "dd-MM-yyyy"),
            waktu: Utilities.formatDate(d, "GMT+7", "HH:mm") + " WIB",
            status: logs[j][4].toString()
          });
        }
      }
    }
    return list;
  } catch (e) { return []; }
}

// 5. DATA MASTER KONSOL ADMINISTRATOR
function getAdminDashboardData() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetGTK = ss.getSheetByName("DataGTK");
    var sheetPresensi = ss.getSheetByName("Presensi");
    
    var listGtk = [];
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0]) {
          listGtk.push({ nuptk: dataGTK[i][0].toString().trim(), nama: dataGTK[i][1] ? dataGTK[i][1].toString().trim() : "" });
        }
      }
    }
    
    var rekapAll = [];
    if (sheetPresensi && listGtk.length > 0) {
      var logs = sheetPresensi.getDataRange().getValues();
      var kini = new Date();
      var bKini = Utilities.formatDate(kini, "GMT+7", "MM");
      var tKini = Utilities.formatDate(kini, "GMT+7", "yyyy");
      
      listGtk.forEach(function(gtk) {
        var h = 0, iz = 0, s = 0;
        for (var j = 1; j < logs.length; j++) {
          if (logs[j][2] && logs[j][2].toString().trim() === gtk.nuptk) {
            var d = new Date(logs[j][0]);
            if (Utilities.formatDate(d, "GMT+7", "MM") === bKini && Utilities.formatDate(d, "GMT+7", "yyyy") === tKini) {
              if (logs[j][4] === "Hadir") h++;
              if (logs[j][4] === "Izin") iz++;
              if (logs[j][4] === "Sakit") s++;
            }
          }
        }
        rekapAll.push({ nuptk: gtk.nuptk, nama: gtk.nama, hadir: h, izin: iz, sakit: s });
      });
    } else {
      rekapAll = listGtk.map(function(g) { return { nuptk: g.nuptk, nama: g.nama, hadir: 0, izin: 0, sakit: 0 }; });
    }
    return { listGtk: listGtk, rekapAll: rekapAll };
  } catch (e) {
    return { listGtk: [], rekapAll: [] };
  }
}

// 6. GENERATE MONTHLY PDF REPORT
function generateMonthlyPDFReport(nuptk, bulan, tahun) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetGTK = ss.getSheetByName("DataGTK");
    var sheetPresensi = ss.getSheetByName("Presensi");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    
    var namaGTK = "Tidak Diketahui";
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() === targetNuptk) {
          namaGTK = dataGTK[i][1];
          break;
        }
      }
    }
    
    var rowsHtml = "";
    var countHadir = 0, countIzin = 0, countSakit = 0;
    
    if (sheetPresensi) {
      var logs = sheetPresensi.getDataRange().getValues();
      var idx = 1;
      for (var j = 1; j < logs.length; j++) {
        if (logs[j][2] && logs[j][2].toString().trim() === targetNuptk) {
          var d = new Date(logs[j][0]);
          if (Utilities.formatDate(d, "GMT+7", "MM") === bulan && Utilities.formatDate(d, "GMT+7", "yyyy") === tahun) {
            var status = logs[j][4];
            if (status === "Hadir") countHadir++;
            if (status === "Izin") countIzin++;
            if (status === "Sakit") countSakit++;
            
            rowsHtml += "<tr>" +
                        "<td style='text-align:center;'>" + idx + "</td>" +
                        "<td>" + Utilities.formatDate(d, "GMT+7", "dd-MM-yyyy") + "</td>" +
                        "<td>" + Utilities.formatDate(d, "GMT+7", "HH:mm") + " WIB</td>" +
                        "<td>" + status + "</td>" +
                        "<td>" + (status === "Hadir" ? "Tepat Waktu" : "Keterangan Terlampir") + "</td>" +
                        "</tr>";
            idx++;
          }
        }
      }
    }
    
    if (rowsHtml === "") rowsHtml = "<tr><td colspan='5' style='text-align:center;'>Tidak ada data presensi periode ini</td></tr>";

    var htmlBody = "<html><head><style>" +
      "@page { size: A4; margin: 20mm 15mm; }" +
      "body { font-family: Arial, sans-serif; font-size: 11pt; color: #333; line-height: 1.4; }" +
      ".kop-table { width: 100%; border-bottom: 3px double #000; padding-bottom: 10px; margin-bottom: 20px; }" +
      ".kop-logo { width: 75px; height: 75px; }" +
      ".kop-text { text-align: center; vertical-align: middle; }" +
      ".kop-title { font-size: 16pt; font-weight: bold; margin: 0; color: #006633; }" +
      ".kop-sub { font-size: 9pt; margin: 5px 0 0 0; color: #444; }" +
      ".report-title { text-align: center; font-size: 13pt; font-weight: bold; margin-bottom: 20px; text-decoration: underline; }" +
      ".meta-table { width: 100%; margin-bottom: 15px; }" +
      ".meta-table td { padding: 4px 0; border: none; }" +
      ".data-table { width: 100%; border-collapse: collapse; margin-top: 10px; }" +
      ".data-table th { background-color: #006633; color: white; border: 1px solid #111; padding: 8px; font-size: 10pt; }" +
      ".data-table td { border: 1px solid #aaa; padding: 7px; font-size: 10pt; }" +
      ".summary-box { margin-top: 15px; background-color: #f2f2f2; padding: 10px; border: 1px solid #ccc; font-weight: bold; }" +
      ".ttd-container { margin-top: 40px; width: 100%; }" +
      ".ttd-table { width: 100%; border: none; }" +
      ".ttd-table td { width: 50%; text-align: center; border: none; }" +
      "</style></head><body>" +
      
      "<table class='kop-table'><tr>" +
      "<td style='width:15%; text-align:left; border:none;'><img class='kop-logo' src='https://masalistiqomah.sch.id/wp-content/uploads/2026/05/logo-e1492233052256.png'></td>" +
      "<td class='kop-text' style='width:85%; border:none;'>" +
      "<div class='kop-title'>MADRASAH ALIYAH AL ISTIQOMAH</div>" +
      "<div class='kop-sub'>Jl. Kawasan No. 63 Pasir Awi Rt 004 Rw 002 Suka Asih Kec. Pasar Kemis Kab. Tangerang - Banten 15560</div>" +
      "</td>" +
      "</tr></table>" +
      
      "<div class='report-title'>REKAPITULASI PRESENSI BULANAN GTK</div>" +
      
      "<table class='meta-table'>" +
      "<tr><td style='width:25%;'>Nama Pegawai (PTK)</td><td style='width:3%;'>:</td><td style='font-weight:bold;'>" + namaGTK + "</td></tr>" +
      "<tr><td>NUPTK / ID PegID</td><td>:</td><td>" + targetNuptk + "</td></tr>" +
      "<tr><td>Periode Laporan</td><td>:</td><td>Bulan: " + bulan + " / Tahun: " + tahun + "</td></tr>" +
      "</table>" +
      
      "<table class='data-table'><thead><tr>" +
      "<th style='width:8%;'>No</th><th>Tanggal</th><th>Waktu Log</th><th>Status</th><th>Keterangan</th>" +
      "</tr></thead><tbody>" +
      rowsHtml +
      "</tbody></table>" +
      
      "<div class='summary-box'>Ringkasan &mdash; Hadir: " + countHadir + " Hari | Izin: " + countIzin + " Hari | Sakit: " + countSakit + " Hari</div>" +
      
      "<div class='ttd-container'><table class='ttd-table'><tr>" +
      "<td>Mengetahui,<br>Kepala Madrasah<br><br><br><br><b>_______________________</b></td>" +
      "<td>Tangerang, " + Utilities.formatDate(new Date(), "GMT+7", "dd MMMM yyyy") + "<br>Petugas Administrasi<br><br><br><br><b>_______________________</b></td>" +
      "</tr></table></div>" +
      "</body></html>";
      
    var blob = Utilities.newBlob(htmlBody, "text/html", "Rekap_" + targetNuptk + "_" + bulan + "_" + tahun + ".html");
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var htmlFile = folder.createFile(blob);
    var pdfBlob = htmlFile.getAs("application/pdf");
    var pdfFile = folder.createFile(pdfBlob);
    htmlFile.setTrashed(true);
    
    return pdfFile.getUrl();
  } catch (e) { return "Error: " + e.message; }
}

// 7. GENERATE FILTERED EXCEL DOWNLOAD LINK (ANTI-EMPTY ROW ERROR)
function generateFilteredExcelLink(nuptk, bulan, tahun) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetPresensi = ss.getSheetByName("Presensi");
    var sheetGTK = ss.getSheetByName("DataGTK");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    
    var namaGTK = "Pegawai";
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() === targetNuptk) {
          namaGTK = dataGTK[i][1].toString().trim();
          break;
        }
      }
    }
    
    var tempSpreadsheet = SpreadsheetApp.create("Presensi_" + namaGTK.replace(/\s+/g, "_") + "_" + bulan + "_" + tahun);
    var tempSheet = tempSpreadsheet.getSheets()[0];
    tempSheet.setName("Data Presensi Terfilter");
    
    tempSheet.appendRow(["Nama GTK", ": " + namaGTK]);
    tempSheet.appendRow(["NUPTK / ID", ": " + targetNuptk]);
    tempSheet.appendRow(["Periode", ": " + bulan + " - " + tahun]);
    tempSheet.appendRow([""]); // Baris pembatas string aman
    tempSheet.appendRow(["No", "Timestamp", "Tanggal", "Status Kehadiran"]);
    
    tempSheet.getRange("A5:D5").setBackground("#006633").setFontColor("white").setFontWeight("bold");
    
    var barisData = [];
    if (sheetPresensi) {
      var logs = sheetPresensi.getDataRange().getValues();
      var noIdx = 1;
      for (var j = 1; j < logs.length; j++) {
        var logNuptk = logs[j][2] !== undefined && logs[j][2] !== null ? logs[j][2].toString().trim() : "";
        if (logNuptk === targetNuptk) {
          var tglMentah = logs[j][0];
          if (!tglMentah || isNaN(Date.parse(tglMentah))) continue;
          
          var d = new Date(tglMentah);
          var mStr = Utilities.formatDate(d, "GMT+7", "MM");
          var yStr = Utilities.formatDate(d, "GMT+7", "yyyy");
          
          if (mStr === bulan && yStr === tahun) {
            var timestampFormated = Utilities.formatDate(d, "GMT+7", "dd-MM-yyyy HH:mm") + " WIB";
            var tanggalFormated = Utilities.formatDate(d, "GMT+7", "dd-MM-yyyy");
            var statusAbsen = logs[j][4] ? logs[j][4].toString().trim() : "-";
            
            barisData.push([noIdx, timestampFormated, tanggalFormated, statusAbsen]);
            noIdx++;
          }
        }
      }
    }
    
    if (barisData.length > 0) {
      tempSheet.getRange(6, 1, barisData.length, 4).setValues(barisData);
      tempSheet.getRange(5, 1, barisData.length + 1, 4).setBorder(true, true, true, true, true, true);
      tempSheet.autoResizeColumns(1, 4);
    } else {
      tempSheet.appendRow(["Tidak ada data presensi untuk filter periode ini."]);
      tempSheet.getRange("A6:D6").merge().setFontStyle("italic").setFontColor("#999999");
    }
    
    SpreadsheetApp.flush();
    
    var fileTemp = DriveApp.getFileById(tempSpreadsheet.getId());
    if (DRIVE_FOLDER_ID && DRIVE_FOLDER_ID !== "") {
      try {
        var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
        folder.addFile(fileTemp);
        DriveApp.getRootFolder().removeFile(fileTemp);
      } catch (errDrive) {}
    }
    
    return "https://docs.google.com/spreadsheets/d/" + tempSpreadsheet.getId() + "/export?format=xlsx";
  } catch (e) {
    return "Error: " + e.message;
  }
}
