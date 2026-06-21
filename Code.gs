// CONFIGURATION GLOBAL INTEGRATION
var SPREADSHEET_ID = "1PGuWCE3ex1Yj7Rf5LsjDYz6kKGvJT-L8BsKXV0GF_ys";
var DRIVE_FOLDER_ID = "1aWORr8uz4QVMbBm0eLjeubtvsHJfNDe5";

// Fungsi Utama untuk Menampilkan Aplikasi Web
function doGet(e) {
  if (e && e.parameter.pwa === 'manifest') {
    return HtmlService.createHtmlOutputFromFile('Manifest.json')
        .setMimeType(HtmlService.MimeType.JSON);
  }
  if (e && e.parameter.pwa === 'sw') {
    return HtmlService.createHtmlOutputFromFile('ServiceWorker.js')
        .setMimeType(HtmlService.MimeType.JAVASCRIPT);
  }

  return HtmlService.createTemplateFromFile("Index").evaluate()
      .setTitle("Absensi GTK Madrasah Aliyah Al Istiqomah")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// 1. FUNGSI LOGIN MULTI-USER (MEMBACA DARI SHEET 'USER')
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

// 2. SIMPAN ABSENSI GTK (DENGAN VALIDASI SENIN-SABTU & HARI LIBUR NASIONAL)
function savePresensi(nuptk, tipeAbsen, statusKehadiran) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetGTK = ss.getSheetByName("DataGTK");
    var sheetPresensi = ss.getSheetByName("ABSENSI") || ss.insertSheet("ABSENSI");
    var sheetKalender = ss.getSheetByName("SET_KALENDER");
    
    var now = new Date();
    var hariAngka = now.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    var formatTanggal = Utilities.formatDate(now, "GMT+7", "dd-MM-yyyy");
    var jamMenit = Utilities.formatDate(now, "GMT+7", "HH:mm");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    
    // VALIDASI HARI OPERASIONAL (SENIN - SABTU)
    if (hariAngka === 0) {
      return { success: false, message: "Gagal! Hari ini adalah hari Minggu. Absensi dinonaktifkan." };
    }
    
    // VALIDASI HARI LIBUR NASIONAL DARI SHEET SET_KALENDER
    if (sheetKalender) {
      var dataKalender = sheetKalender.getDataRange().getValues();
      for (var k = 1; k < dataKalender.length; k++) {
        if (dataKalender[k][0]) {
          var tglLiburDb = "";
          if (dataKalender[k][0] instanceof Date) {
            tglLiburDb = Utilities.formatDate(dataKalender[k][0], "GMT+7", "dd-MM-yyyy");
          } else {
            tglLiburDb = dataKalender[k][0].toString().trim();
          }
          
          if (tglLiburDb === formatTanggal) {
            var namaLibur = dataKalender[k][1] ? dataKalender[k][1].toString().trim() : "Hari Libur Nasional";
            return { success: false, message: "Gagal! Hari ini absensi libur karena: " + namaLibur };
          }
        }
      }
    }
    
    if (sheetPresensi.getLastRow() === 0) {
      sheetPresensi.appendRow(["Timestamp", "Tanggal", "NUPTK", "Nama GTK", "Datang", "Status Datang", "Pulang", "Status Pulang"]);
    }
    
    // VALIDASI PEMBATASAN WAKTU OPERASIONAL
    if (tipeAbsen === "Datang") {
      if (jamMenit < "06:00" || jamMenit > "09:00") {
        return { success: false, message: "Gagal! Absen Datang hanya dibuka pukul 06:00 - 09:00 WIB (Sekrang " + jamMenit + ")" };
      }
    } else if (tipeAbsen === "Pulang") {
      if (jamMenit < "13:00" || jamMenit > "18:00") {
        return { success: false, message: "Gagal! Absen Pulang hanya dibuka pukul 13:00 - 18:00 WIB (Sekarang " + jamMenit + ")" };
      }
    }
    
    var namaPegawai = "";
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() === targetNuptk) {
          namaPegawai = dataGTK[i][2] ? dataGTK[i][2].toString().trim() : (dataGTK[i][1] ? dataGTK[i][1].toString().trim() : "");
          break;
        }
      }
    }
    if (!namaPegawai) namaPegawai = "Pegawai (" + targetNuptk + ")";
    
    var logs = sheetPresensi.getDataRange().getValues();
    var barisDitemukan = -1;
    
    for (var j = 1; j < logs.length; j++) {
      if (logs[j][1] && logs[j][2]) {
        var logTgl = logs[j][1].toString().trim();
        if (logTgl === formatTanggal && logs[j][2].toString().trim() === targetNuptk) {
          barisDitemukan = j + 1;
          break;
        }
      }
    }
    
    var waktuSekarangWib = jamMenit + " WIB";
    
    if (barisDitemukan > -1) {
      if (tipeAbsen === "Datang") {
        var checkDatang = sheetPresensi.getRange(barisDitemukan, 5).getValue();
        if (checkDatang !== "" && checkDatang !== "-") return { success: false, message: "Anda sudah melakukan Absen Datang hari ini!" };
        
        sheetPresensi.getRange(barisDitemukan, 1).setValue(now);
        sheetPresensi.getRange(barisDitemukan, 5).setValue(waktuSekarangWib);
        sheetPresensi.getRange(barisDitemukan, 6).setValue(statusKehadiran);
      } else {
        var checkPulang = sheetPresensi.getRange(barisDitemukan, 7).getValue();
        if (checkPulang !== "" && checkPulang !== "-") return { success: false, message: "Anda sudah melakukan Absen Pulang hari ini!" };
        
        sheetPresensi.getRange(barisDitemukan, 1).setValue(now);
        sheetPresensi.getRange(barisDitemukan, 7).setValue(waktuSekarangWib);
        sheetPresensi.getRange(barisDitemukan, 8).setValue(statusKehadiran);
      }
    } else {
      var rowBaru = [];
      if (tipeAbsen === "Datang") {
        rowBaru = [now, formatTanggal, targetNuptk, namaPegawai, waktuSekarangWib, statusKehadiran, "-", "-"];
      } else {
        rowBaru = [now, formatTanggal, targetNuptk, namaPegawai, "-", "-", waktuSekarangWib, statusKehadiran];
      }
      sheetPresensi.appendRow(rowBaru);
    }
    
    return { success: true, name: namaPegawai };
  } catch (e) {
    return { success: false, message: "Gagal menyimpan: " + e.message };
  }
}

// 3. AMBIL STATISTIK REALTIME DASHBOARD UTAMA
function getRealtimeStatistics() {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetGTK = ss.getSheetByName("DataGTK");
    var sheetPresensi = ss.getSheetByName("ABSENSI");
    
    var totalGTK = 0;
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() !== "" && dataGTK[i][0].toString().toLowerCase() !== "nuptk") {
          totalGTK++;
        }
      }
    }
    
    var hadir = 0, izin = 0;
    if (sheetPresensi) {
      var data = sheetPresensi.getDataRange().getValues();
      var todayStr = Utilities.formatDate(new Date(), "GMT+7", "dd-MM-yyyy");
      for (var i = 1; i < data.length; i++) {
        if (data[i][1]) {
          var logDate = data[i][1].toString().trim();
          if (logDate === todayStr) {
            var statDatang = data[i][5] ? data[i][5].toString().trim() : "";
            var statPulang = data[i][7] ? data[i][7].toString().trim() : "";
            if (statDatang === "Hadir" || statPulang === "Hadir") hadir++;
            else if (statDatang === "Izin" || statDatang === "Sakit" || statPulang === "Izin" || statPulang === "Sakit") izin++;
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

// 4. RINCIAN ABSENSI PER GTK
function getRincianAbsenPerGtk(nuptk) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetPresensi = ss.getSheetByName("ABSENSI");
    if (!sheetPresensi) return [];
    
    var logs = sheetPresensi.getDataRange().getValues();
    var list = [];
    var kini = new Date();
    var bulanKini = Utilities.formatDate(kini, "GMT+7", "MM");
    var tahunKini = Utilities.formatDate(kini, "GMT+7", "yyyy");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    
    for (var j = 1; j < logs.length; j++) {
      if (logs[j][2] && logs[j][2].toString().trim() === targetNuptk) {
        var logTgl = logs[j][1] ? logs[j][1].toString().trim() : "";
        if (logTgl.indexOf("-" + bulanKini + "-" + tahunKini) > -1) {
          list.push({
            tanggal: logTgl,
            datang: logs[j][4] ? logs[j][4].toString() : "-",
            statusDatang: logs[j][5] ? logs[j][5].toString() : "-",
            pulang: logs[j][6] ? logs[j][6].toString() : "-",
            statusPulang: logs[j][7] ? logs[j][7].toString() : "-"
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
    var sheetPresensi = ss.getSheetByName("ABSENSI");
    
    var listGtk = [];
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        var nuptkRaw = dataGTK[i][0] ? dataGTK[i][0].toString().trim() : "";
        if (nuptkRaw !== "" && nuptkRaw.toLowerCase() !== "nuptk") {
          var namaRaw = dataGTK[i][2] ? dataGTK[i][2].toString().trim() : (dataGTK[i][1] ? dataGTK[i][1].toString().trim() : "Tanpa Nama");
          listGtk.push({ nuptk: nuptkRaw, nama: namaRaw });
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
            var logTgl = logs[j][1] ? logs[j][1].toString().trim() : "";
            if (logTgl.indexOf("-" + bKini + "-" + tKini) > -1) {
              var statDatang = logs[j][5] ? logs[j][5].toString().trim() : "";
              if (statDatang === "Hadir") h++;
              if (statDatang === "Izin") iz++;
              if (statDatang === "Sakit") s++;
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
    var sheetPresensi = ss.getSheetByName("ABSENSI");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    var targetBulan = bulan ? bulan.toString().trim() : "";
    var targetTahun = tahun ? tahun.toString().trim() : "";
    
    var namaGTK = "Tidak Diketahui";
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() === targetNuptk) {
          namaGTK = dataGTK[i][2] ? dataGTK[i][2].toString().trim() : (dataGTK[i][1] ? dataGTK[i][1].toString().trim() : "");
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
        var logNuptk = logs[j][2] !== undefined && logs[j][2] !== null ? logs[j][2].toString().trim() : "";
        if (logNuptk === targetNuptk) {
          var logTgl = logs[j][1] ? logs[j][1].toString().trim() : "";
          if (logTgl.indexOf("-" + targetBulan + "-" + targetTahun) > -1) {
            var jamDatang = logs[j][4] ? logs[j][4].toString().trim() : "-";
            var statDatang = logs[j][5] ? logs[j][5].toString().trim() : "-";
            var jamPulang = logs[j][6] ? logs[j][6].toString().trim() : "-";
            var statPulang = logs[j][7] ? logs[j][7].toString().trim() : "-";
            
            if (statDatang === "Hadir") countHadir++;
            if (statDatang === "Izin") countIzin++;
            if (statDatang === "Sakit") countSakit++;
            
            rowsHtml += "<tr>" +
                        "<td style='text-align:center;'>" + idx + "</td>" +
                        "<td style='text-align:center;'>" + logTgl + "</td>" +
                        "<td style='text-align:center;'>" + jamDatang + "</td>" +
                        "<td style='text-align:center;'><b>" + statDatang + "</b></td>" +
                        "<td style='text-align:center;'>" + jamPulang + "</td>" +
                        "<td style='text-align:center;'><b>" + statPulang + "</b></td>" +
                        "</tr>";
            idx++;
          }
        }
      }
    }
    
    if (rowsHtml === "") {
      rowsHtml = "<tr><td colspan='6' style='text-align:center; color:#999; font-style:italic; padding:15px;'>Tidak ada data presensi untuk GTK ini pada periode " + targetBulan + "-" + targetTahun + "</td></tr>";
    }

    var daftarBulan = {"01":"Januari","02":"Februari","03":"Maret","04":"April","05":"Mei","06":"Juni","07":"Juli","08":"Agustus","09":"September","10":"Oktober","11":"November","12":"Desember"};
    var namaBulanPilihan = daftarBulan[targetBulan] || targetBulan;

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
      "<div class='kop-sub'>Jl. Kawasan No. 63 Pasir Awi Rt 004 Rw 002 Suka Asih Kec. Pasar Kemis Kab. Tangerang - Banten <br> Website : https://masalistiqomah.sch.id email: masalistiqomah1995@gmail.com</div>" +
      "</td>" +
      "</tr></table>" +
      "<div class='report-title'>REKAPITULASI PRESENSI BULANAN GTK</div>" +
      "<table class='meta-table'>" +
      "<tr><td style='width:25%;'>Nama Pegawai (PTK)</td><td style='width:3%;'>:</td><td style='font-weight:bold;'>" + namaGTK + "</td></tr>" +
      "<tr><td>NUPTK / ID PegID</td><td>:</td><td>" + targetNuptk + "</td></tr>" +
      "<tr><td>Periode Laporan</td><td>:</td><td>Bulan: " + namaBulanPilihan + " / Tahun: " + targetTahun + "</td></tr>" +
      "</table>" +
      "<table class='data-table'><thead><tr>" +
      "<th style='width:6%;'>No</th><th>Tanggal</th><th>Jam Datang</th><th>Status Datang</th><th>Jam Pulang</th><th>Status Pulang</th>" +
      "</tr></thead><tbody>" +
      rowsHtml +
      "</tbody></table>" +
      "<div class='summary-box'>Ringkasan &mdash; Hadir: " + countHadir + " Hari | Izin: " + countIzin + " Hari | Sakit: " + countSakit + " Hari</div>" +
      "<div class='ttd-container'><table class='ttd-table'><tr>" +
      "<td>Mengetahui,<br>Kepala Madrasah<br><br><br><br><b>H. Ahmad Dimyati, M.Pd</b></td>" +
      "<td>Tangerang, " + Utilities.formatDate(new Date(), "GMT+7", "dd MMMM yyyy") + "<br>Petugas Administrasi<br><br><br><br><b>_______________________</b></td>" +
      "</tr></table></div>" +
      "</body></html>";
      
    var blob = Utilities.newBlob(htmlBody, "text/html", "Rekap_" + targetNuptk + "_" + targetBulan + "_" + targetTahun + ".html");
    var folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    var htmlFile = folder.createFile(blob);
    var pdfBlob = htmlFile.getAs("application/pdf");
    var pdfFile = folder.createFile(pdfBlob);
    htmlFile.setTrashed(true);
    
    return pdfFile.getUrl();
  } catch (e) { return "Error: " + e.message; }
}

// 7. GENERATE FILTERED EXCEL DOWNLOAD LINK
function generateFilteredExcelLink(nuptk, bulan, tahun) {
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheetPresensi = ss.getSheetByName("ABSENSI");
    var sheetGTK = ss.getSheetByName("DataGTK");
    var targetNuptk = nuptk ? nuptk.toString().trim() : "";
    
    var namaGTK = "Pegawai";
    if (sheetGTK) {
      var dataGTK = sheetGTK.getDataRange().getValues();
      for (var i = 1; i < dataGTK.length; i++) {
        if (dataGTK[i][0] && dataGTK[i][0].toString().trim() === targetNuptk) {
          namaGTK = dataGTK[i][2] ? dataGTK[i][2].toString().trim() : (dataGTK[i][1] ? dataGTK[i][1].toString().trim() : "");
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
    tempSheet.appendRow([""]); 
    tempSheet.appendRow(["No", "Tanggal", "Jam Datang", "Status Datang", "Jam Pulang", "Status Pulang"]);
    tempSheet.getRange("A5:F5").setBackground("#006633").setFontColor("white").setFontWeight("bold");
    
    var barisData = [];
    if (sheetPresensi) {
      var logs = sheetPresensi.getDataRange().getValues();
      var noIdx = 1;
      for (var j = 1; j < logs.length; j++) {
        var logNuptk = logs[j][2] !== undefined && logs[j][2] !== null ? logs[j][2].toString().trim() : "";
        if (logNuptk === targetNuptk) {
          var logTgl = logs[j][1] ? logs[j][1].toString().trim() : "";
          if (logTgl.indexOf("-" + bulan + "-" + tahun) > -1) {
            var jamDatang = logs[j][4] ? logs[j][4].toString().trim() : "-";
            var statDatang = logs[j][5] ? logs[j][5].toString().trim() : "-";
            var jamPulang = logs[j][6] ? logs[j][6].toString().trim() : "-";
            var statPulang = logs[j][7] ? logs[j][7].toString().trim() : "-";
            
            barisData.push([noIdx, logTgl, jamDatang, statDatang, jamPulang, statPulang]);
            noIdx++;
          }
        }
      }
    }
    
    if (barisData.length > 0) {
      tempSheet.getRange(6, 1, barisData.length, 6).setValues(barisData);
      tempSheet.getRange(5, 1, barisData.length + 1, 6).setBorder(true, true, true, true, true, true);
      tempSheet.autoResizeColumns(1, 6);
    } else {
      tempSheet.appendRow(["Tidak ada data presensi untuk filter periode ini."]);
      tempSheet.getRange("A6:F6").merge().setFontStyle("italic").setFontColor("#999999");
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