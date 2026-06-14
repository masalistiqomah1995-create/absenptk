const SPREADSHEET_ID = "1mC6UT80cDxAAnutZyhxuc3eVpVAfytp97O_OP1Cpsis";

function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('ABSENSI GURU MADRASAH ALIYAH AL ISTIQOMAH')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// Sistem Login
function verifyLogin(username, password) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('user');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    const [user, pass, role] = data[i];
    if (user == username && pass == password) {
      return { status: true, role: role, username: user };
    }
  }
  return { status: false, message: 'Username atau Password salah.' };
}

// Ambil Statistik untuk Halaman Home
function getStats() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Absensi');
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");
  
  let hadirCount = 0;
  for(let i=1; i<data.length; i++) {
    const [tanggal,,,,, status] = data[i];
    const tglFormat = Utilities.formatDate(new Date(tanggal), "Asia/Jakarta", "yyyy-MM-dd");
    if(tglFormat === today && status === 'Hadir') {
      hadirCount++;
    }
  }
  
  return { hadir: hadirCount };
}

// Manajemen Guru
function getTeachers() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_guru');
  const data = sheet.getDataRange().getValues();
  let teachers = [];
  for(let i=1; i<data.length; i++) {
    teachers.push({id: data[i][0], name: data[i][1]});
  }
  return teachers;
}

function addTeacher(id, name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Data_guru');
  sheet.appendRow([id, name]);
  return true;
}

// Absensi Guru
function submitAttendance(nama, status) {
  const SPREADSHEET_ID = "1mC6UT80cDxAAnutZyhxuc3eVpVAfytp97O_OP1Cpsis";
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Absensi');
  const now = new Date();
  
  // Ambil waktu saat ini dalam format HH:mm (WIB)
  const currentTime = Utilities.formatDate(now, "Asia/Jakarta", "HH:mm");
  
  // Validasi rentang waktu absen (06:00 s/d 08:00)
  if (currentTime < "06:00" || currentTime > "08:00") {
    return { success: false, message: "Absensi hanya dapat dilakukan pada pukul 06.00 s/d 08.00 WIB." };
  }
  
  const tanggal = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd HH:mm:ss");
  
  // Cek apakah sudah absen hari ini
  const data = sheet.getDataRange().getValues();
  const today = Utilities.formatDate(now, "Asia/Jakarta", "yyyy-MM-dd");
  for(let i=1; i<data.length; i++) {
    const [tgl, namaGuru] = data[i];
    if(namaGuru === nama && Utilities.formatDate(new Date(tgl), "Asia/Jakarta", "yyyy-MM-dd") === today) {
      return { success: false, message: "Anda sudah melakukan absensi hari ini!" };
    }
  }
  
  sheet.appendRow([tanggal, nama, status, "Tepat Waktu"]);
  return { success: true, message: "Absensi berhasil disimpan." };
}

// Rekap per Bulan
function getRecap(monthYear, namaGuru) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Absensi');
  const data = sheet.getDataRange().getValues();
  let result = [];
  
  for(let i=1; i<data.length; i++) {
    const [tanggal, nama, status, ket] = data[i];
    const rowMonthYear = Utilities.formatDate(new Date(tanggal), "Asia/Jakarta", "yyyy-MM");
    
    if (rowMonthYear === monthYear) {
      if (!namaGuru || namaGuru === "Semua" || nama === namaGuru) {
        result.push({
          tanggal: Utilities.formatDate(new Date(tanggal), "Asia/Jakarta", "dd-MM-yyyy HH:mm"),
          nama: nama,
          status: status,
          keterangan: ket
        });
      }
    }
  }
  return result;
}

// Pengaturan Tahun Pelajaran
function getAcademicYear() {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Pengaturan');
  if(!sheet) return "2025/2026"; // Default jika sheet belum dibuat
  return sheet.getRange(1, 2).getValue();
}

function updateAcademicYear(year) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Pengaturan');
  sheet.getRange(1, 2).setValue(year);
  return true;
}
