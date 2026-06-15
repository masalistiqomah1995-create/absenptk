/*************************************************
 *
 * ABSENSI GURU DIGITAL
 * FINAL V3 CLEAN
 *
 * PART 1
 * CONFIG + DATABASE + AUTH + SESSION
 *
 *************************************************/


/*************************************************
 * CONFIG
 *************************************************/

const CONFIG = {

  SPREADSHEET_ID:
  "1mC6UT80cDxAAnutZyhxuc3eVpVAfytp97O_OP1Cpsis",

  TIMEZONE:
  "Asia/Jakarta",

  ADMIN_USERNAME:
  "admin",

  ADMIN_PASSWORD:
  "admin123",

  WHATSAPP_API:
  "https://api.fonnte.com/send",

  WHATSAPP_TOKEN:
  "",

  EMAIL_ADMIN:
  "admin@sekolah.sch.id"

};


/*************************************************
 * SESSION
 *************************************************/

const SESSION_TIMEOUT =
21600;


/*************************************************
 * WEB APP
 *************************************************/

function doGet() {

  return HtmlService
    .createTemplateFromFile(
      "Index"
    )
    .evaluate()
    .setTitle(
      "Absensi Guru Digital"
    )
    .setXFrameOptionsMode(
      HtmlService
      .XFrameOptionsMode
      .ALLOWALL
    );

}


function include(filename){

  return HtmlService
  .createHtmlOutputFromFile(
  filename
  )
  .getContent();

}


/*************************************************
 * DATABASE
 *************************************************/

function getSpreadsheet(){

  return SpreadsheetApp.openById(
    CONFIG.SPREADSHEET_ID
  );

}


function getSheet(name){

  return getSpreadsheet()
  .getSheetByName(name);

}


/*************************************************
 * SETUP DATABASE
 *************************************************/

function setupDatabase(){

  const ss =
  getSpreadsheet();

  createGuruSheet(ss);

  createAbsensiSheet(ss);

  createRekapSheet(ss);

  createKontakSheet(ss);

  createAuditSheet(ss);

  return true;

}


/*************************************************
 * SHEET GURU
 *************************************************/

function createGuruSheet(ss){

  let sheet =
  ss.getSheetByName(
  "Guru"
  );

  if(sheet) return;

  sheet =
  ss.insertSheet(
  "Guru"
  );

  sheet.appendRow([

    "ID Guru",

    "Nama Guru",

    "NIP",

    "Jabatan",

    "Username",

    "Password"

  ]);

}


/*************************************************
 * SHEET ABSENSI
 *************************************************/

function createAbsensiSheet(ss){

  let sheet =
  ss.getSheetByName(
  "Absensi"
  );

  if(sheet) return;

  sheet =
  ss.insertSheet(
  "Absensi"
  );

  sheet.appendRow([

    "ID",

    "Tanggal",

    "Nama Guru",

    "Jam Masuk",

    "Status Masuk",

    "Jam Pulang",

    "Status Pulang"

  ]);

}


/*************************************************
 * SHEET REKAP
 *************************************************/

function createRekapSheet(ss){

  let sheet =
  ss.getSheetByName(
  "Rekap"
  );

  if(sheet) return;

  sheet =
  ss.insertSheet(
  "Rekap"
  );

}


/*************************************************
 * SHEET KONTAK
 *************************************************/

function createKontakSheet(ss){

  let sheet =
  ss.getSheetByName(
  "Kontak"
  );

  if(sheet) return;

  sheet =
  ss.insertSheet(
  "Kontak"
  );

  sheet.appendRow([

    "Nama Guru",

    "Nomor WA",

    "Email"

  ]);

}


/*************************************************
 * SHEET AUDIT
 *************************************************/

function createAuditSheet(ss){

  let sheet =
  ss.getSheetByName(
  "AuditLog"
  );

  if(sheet) return;

  sheet =
  ss.insertSheet(
  "AuditLog"
  );

  sheet.appendRow([

    "Tanggal",

    "Jam",

    "User",

    "Role",

    "Aktivitas"

  ]);

}


/*************************************************
 * UTILITIES
 *************************************************/

function formatTanggal(date){

  return Utilities.formatDate(

    date,

    CONFIG.TIMEZONE,

    "dd/MM/yyyy"

  );

}


function formatJam(date){

  return Utilities.formatDate(

    date,

    CONFIG.TIMEZONE,

    "HH:mm:ss"

  );

}


function generateId(prefix){

  return (

    prefix +

    "-" +

    Utilities.formatDate(

      new Date(),

      CONFIG.TIMEZONE,

      "yyyyMMddHHmmss"

    )

  );

}


/*************************************************
 * SESSION CACHE
 *************************************************/

function createSession(user){

  const token =
  Utilities.getUuid();

  CacheService
  .getScriptCache()
  .put(

    token,

    JSON.stringify(user),

    SESSION_TIMEOUT

  );

  return token;

}


function getSession(token){

  const data =
  CacheService
  .getScriptCache()
  .get(token);

  if(!data){

    return null;

  }

  return JSON.parse(data);

}


function destroySession(token){

  CacheService
  .getScriptCache()
  .remove(token);

}


/*************************************************
 * AUDIT LOG
 *************************************************/

function writeAuditLog(

nama,

role,

aktivitas

){

  const sheet =
  getSheet(
  "AuditLog"
  );

  sheet.appendRow([

    formatTanggal(
    new Date()
    ),

    formatJam(
    new Date()
    ),

    nama,

    role,

    aktivitas

  ]);

}


/*************************************************
 * LOGIN
 *************************************************/

function login(

username,

password

){

  try{

    /*********
     * ADMIN
     *********/

    if(

      username ==
      CONFIG.ADMIN_USERNAME

      &&

      password ==
      CONFIG.ADMIN_PASSWORD

    ){

      const user = {

        id:"ADMIN",

        nama:"Administrator",

        role:"admin"

      };

      const token =
      createSession(user);

      writeAuditLog(

        user.nama,

        user.role,

        "LOGIN"

      );

      return {

        success:true,

        token:token,

        user:user

      };

    }


    /*********
     * GURU
     *********/

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(

      let i=1;

      i<data.length;

      i++

    ){

      if(

        data[i][4]
        ==
        username

        &&

        data[i][5]
        ==
        password

      ){

        const user = {

          id:data[i][0],

          nama:data[i][1],

          role:"guru"

        };

        const token =
        createSession(user);

        writeAuditLog(

          user.nama,

          user.role,

          "LOGIN"

        );

        return {

          success:true,

          token:token,

          user:user

        };

      }

    }

    return {

      success:false,

      message:
      "Username atau password salah"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * LOGOUT
 *************************************************/

function logout(token){

  const user =
  getSession(token);

  if(user){

    writeAuditLog(

      user.nama,

      user.role,

      "LOGOUT"

    );

  }

  destroySession(token);

  return true;

}


/*************************************************
 * SECURITY
 *************************************************/

function requireLogin(token){

  const user =
  getSession(token);

  if(!user){

    throw new Error(
    "Session berakhir"
    );

  }

  return user;

}


function requireAdmin(token){

  const user =
  requireLogin(token);

  if(

    user.role
    !==
    "admin"

  ){

    throw new Error(
    "Akses ditolak"
    );

  }

  return true;

}
/*************************************************
 *
 * PART 2
 * CRUD GURU FINAL
 *
 *************************************************/


/*************************************************
 * AMBIL SEMUA GURU
 *************************************************/

function getGuru(){

  try{

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    const hasil = [];

    for(
      let i=1;
      i<data.length;
      i++
    ){

      hasil.push({

        id:data[i][0],

        nama:data[i][1],

        nip:data[i][2],

        jabatan:data[i][3],

        username:data[i][4],

        password:data[i][5]

      });

    }

    return {

      success:true,

      data:hasil

    };

  }
  catch(err){

    return {

      success:false,

      message:err.toString()

    };

  }

}


/*************************************************
 * AMBIL GURU BERDASARKAN ID
 *************************************************/

function getGuruById(idGuru){

  try{

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][0] == idGuru
      ){

        return {

          success:true,

          data:{

            id:data[i][0],

            nama:data[i][1],

            nip:data[i][2],

            jabatan:data[i][3],

            username:data[i][4],

            password:data[i][5]

          }

        };

      }

    }

    return {

      success:false,

      message:
      "Data guru tidak ditemukan"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * TAMBAH GURU
 *************************************************/

function simpanGuru(dataGuru){

  try{

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][4]
        ==
        dataGuru.username
      ){

        return {

          success:false,

          message:
          "Username sudah digunakan"

        };

      }

    }

    const idGuru =
    generateId("GR");

    sheet.appendRow([

      idGuru,

      dataGuru.nama,

      dataGuru.nip,

      dataGuru.jabatan,

      dataGuru.username,

      dataGuru.password

    ]);

    writeAuditLog(

      "Administrator",

      "admin",

      "TAMBAH GURU : " +
      dataGuru.nama

    );

    return {

      success:true,

      id:idGuru,

      message:
      "Guru berhasil ditambahkan"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * UPDATE GURU
 *************************************************/

function updateGuru(dataGuru){

  try{

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][0]
        ==
        dataGuru.id
      ){

        sheet
        .getRange(i+1,2)
        .setValue(
        dataGuru.nama
        );

        sheet
        .getRange(i+1,3)
        .setValue(
        dataGuru.nip
        );

        sheet
        .getRange(i+1,4)
        .setValue(
        dataGuru.jabatan
        );

        sheet
        .getRange(i+1,5)
        .setValue(
        dataGuru.username
        );

        sheet
        .getRange(i+1,6)
        .setValue(
        dataGuru.password
        );

        writeAuditLog(

          "Administrator",

          "admin",

          "EDIT GURU : " +
          dataGuru.nama

        );

        return {

          success:true,

          message:
          "Data guru berhasil diperbarui"

        };

      }

    }

    return {

      success:false,

      message:
      "Guru tidak ditemukan"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * HAPUS GURU
 *************************************************/

function hapusGuru(idGuru){

  try{

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][0]
        ==
        idGuru
      ){

        const namaGuru =
        data[i][1];

        sheet.deleteRow(
        i+1
        );

        writeAuditLog(

          "Administrator",

          "admin",

          "HAPUS GURU : " +
          namaGuru

        );

        return {

          success:true,

          message:
          "Guru berhasil dihapus"

        };

      }

    }

    return {

      success:false,

      message:
      "Guru tidak ditemukan"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * CARI GURU
 *************************************************/

function searchGuru(keyword){

  try{

    keyword =
    String(keyword)
    .toLowerCase();

    const guru =
    getGuru();

    if(
      !guru.success
    ){

      return guru;

    }

    const hasil =
    guru.data.filter(function(item){

      return (

        String(item.nama)
        .toLowerCase()
        .indexOf(keyword)
        > -1

        ||

        String(item.nip)
        .toLowerCase()
        .indexOf(keyword)
        > -1

        ||

        String(item.jabatan)
        .toLowerCase()
        .indexOf(keyword)
        > -1

      );

    });

    return {

      success:true,

      data:hasil

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * PAGINATION GURU
 *************************************************/

function paginationGuru(

page,

limit

){

  try{

    page =
    Number(page) || 1;

    limit =
    Number(limit) || 10;

    const guru =
    getGuru();

    if(
      !guru.success
    ){

      return guru;

    }

    const totalData =
    guru.data.length;

    const totalPage =
    Math.ceil(
      totalData
      /
      limit
    );

    const start =
    (page-1)
    *
    limit;

    const end =
    start
    +
    limit;

    return {

      success:true,

      page:page,

      totalPage:
      totalPage,

      totalData:
      totalData,

      data:
      guru.data.slice(
      start,
      end
      )

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * RESET PASSWORD GURU
 *************************************************/

function resetPasswordGuru(

idGuru

){

  try{

    const sheet =
    getSheet("Guru");

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][0]
        ==
        idGuru
      ){

        sheet
        .getRange(
          i+1,
          6
        )
        .setValue(
        "123456"
        );

        writeAuditLog(

          "Administrator",

          "admin",

          "RESET PASSWORD : " +
          data[i][1]

        );

        return {

          success:true,

          message:
          "Password berhasil direset"

        };

      }

    }

    return {

      success:false,

      message:
      "Guru tidak ditemukan"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}
/*************************************************
 *
 * PART 3
 * ABSENSI FINAL
 *
 *************************************************/


/*************************************************
 * KONTAK GURU
 *************************************************/

function getKontakGuru(namaGuru){

  try{

    const sheet =
    getSheet("Kontak");

    if(!sheet){

      return null;

    }

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][0]
        ==
        namaGuru
      ){

        return {

          wa:data[i][1],

          email:data[i][2]

        };

      }

    }

    return null;

  }
  catch(err){

    return null;

  }

}


/*************************************************
 * KIRIM WHATSAPP
 *************************************************/

function sendWhatsApp(
nomor,
pesan
){

  try{

    if(
      !CONFIG.WHATSAPP_TOKEN
    ){

      return;

    }

    UrlFetchApp.fetch(

      CONFIG.WHATSAPP_API,

      {

        method:"post",

        headers:{

          Authorization:
          CONFIG.WHATSAPP_TOKEN

        },

        payload:{

          target:nomor,

          message:pesan

        }

      }

    );

  }
  catch(err){

    Logger.log(err);

  }

}


/*************************************************
 * KIRIM EMAIL
 *************************************************/

function sendEmailGuru(

email,

subject,

message

){

  try{

    if(!email){

      return;

    }

    MailApp.sendEmail({

      to:email,

      subject:subject,

      htmlBody:message

    });

  }
  catch(err){

    Logger.log(err);

  }

}


/*************************************************
 * STATUS MASUK
 *************************************************/

function getStatusMasuk(jam){

  const menit =

  jam.getHours() * 60 +

  jam.getMinutes();

  const jam0600 = 360;

  const jam0800 = 480;

  const jam0900 = 540;

  if(
    menit < jam0600
  ){

    return {

      valid:false,

      status:
      "Belum Waktu Absen"

    };

  }

  if(
    menit <= jam0800
  ){

    return {

      valid:true,

      status:
      "Tepat Waktu"

    };

  }

  if(
    menit <= jam0900
  ){

    return {

      valid:true,

      status:
      "Terlambat"

    };

  }

  return {

    valid:false,

    status:
    "Tidak Bisa Absen"

  };

}


/*************************************************
 * ABSEN MASUK
 *************************************************/

function absenMasuk(

token

){

  try{

    const user =
    requireLogin(
    token
    );

    const now =
    new Date();

    const tanggal =
    formatTanggal(
    now
    );

    const jam =
    formatJam(
    now
    );

    const statusData =
    getStatusMasuk(
    now
    );

    if(
      !statusData.valid
    ){

      return {

        success:false,

        message:
        statusData.status

      };

    }

    const sheet =
    getSheet(
    "Absensi"
    );

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(

        data[i][1]
        ==
        tanggal

        &&

        data[i][2]
        ==
        user.nama

      ){

        return {

          success:false,

          message:
          "Sudah absen masuk"

        };

      }

    }

    const id =
    generateId("ABS");

    sheet.appendRow([

      id,

      tanggal,

      user.nama,

      jam,

      statusData.status,

      "",

      ""

    ]);

    writeAuditLog(

      user.nama,

      user.role,

      "ABSEN MASUK"

    );

    const kontak =
    getKontakGuru(
    user.nama
    );

    if(kontak){

      sendWhatsApp(

        kontak.wa,

        "✅ ABSEN MASUK\n\n" +

        "Nama : " +

        user.nama +

        "\nJam : " +

        jam +

        "\nStatus : " +

        statusData.status

      );

      sendEmailGuru(

        kontak.email,

        "Absensi Masuk",

        "<b>Absensi Masuk Berhasil</b><br><br>" +

        "Nama : " +

        user.nama +

        "<br>Jam : " +

        jam +

        "<br>Status : " +

        statusData.status

      );

    }

    return {

      success:true,

      jam:jam,

      status:
      statusData.status,

      message:
      "Absen Masuk Berhasil"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * ABSEN PULANG
 *************************************************/

function absenPulang(

token

){

  try{

    const user =
    requireLogin(
    token
    );

    const now =
    new Date();

    const tanggal =
    formatTanggal(
    now
    );

    const jam =
    formatJam(
    now
    );

    const menit =

    now.getHours() * 60 +

    now.getMinutes();

    if(
      menit < 780
    ){

      return {

        success:false,

        message:
        "Belum Waktu Pulang"

      };

    }

    const sheet =
    getSheet(
    "Absensi"
    );

    const data =
    sheet
    .getDataRange()
    .getValues();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(

        data[i][1]
        ==
        tanggal

        &&

        data[i][2]
        ==
        user.nama

      ){

        if(
          data[i][5]
        ){

          return {

            success:false,

            message:
            "Sudah absen pulang"

          };

        }

        sheet
        .getRange(
          i+1,
          6
        )
        .setValue(
        jam
        );

        sheet
        .getRange(
          i+1,
          7
        )
        .setValue(
        "Pulang"
        );

        writeAuditLog(

          user.nama,

          user.role,

          "ABSEN PULANG"

        );

        const kontak =
        getKontakGuru(
        user.nama
        );

        if(kontak){

          sendWhatsApp(

            kontak.wa,

            "🏠 ABSEN PULANG\n\n" +

            "Nama : " +

            user.nama +

            "\nJam : " +

            jam

          );

          sendEmailGuru(

            kontak.email,

            "Absensi Pulang",

            "<b>Absensi Pulang Berhasil</b><br><br>" +

            "Nama : " +

            user.nama +

            "<br>Jam : " +

            jam

          );

        }

        return {

          success:true,

          jam:jam,

          message:
          "Absensi Pulang Berhasil"

        };

      }

    }

    return {

      success:false,

      message:
      "Belum absen masuk"

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * RIWAYAT ABSENSI GURU
 *************************************************/

function getRiwayatAbsensi(
token
){

  try{

    const user =
    requireLogin(
    token
    );

    const sheet =
    getSheet(
    "Absensi"
    );

    const data =
    sheet
    .getDataRange()
    .getValues();

    const hasil = [];

    for(
      let i=1;
      i<data.length;
      i++
    ){

      if(
        data[i][2]
        ==
        user.nama
      ){

        hasil.push({

          id:data[i][0],

          tanggal:data[i][1],

          masuk:data[i][3],

          status:data[i][4],

          pulang:data[i][5],

          statusPulang:
          data[i][6]

        });

      }

    }

    return {

      success:true,

      data:hasil

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * STATISTIK HARI INI
 *************************************************/

function getStatistikHariIni(){

  try{

    const tanggal =
    formatTanggal(
    new Date()
    );

    const guru =
    getGuru().data;

    const absensi =
    getSheet("Absensi")
    .getDataRange()
    .getValues();

    let hadir = 0;
    let terlambat = 0;

    for(
      let i=1;
      i<absensi.length;
      i++
    ){

      if(
        absensi[i][1]
        ==
        tanggal
      ){

        hadir++;

        if(
          absensi[i][4]
          ==
          "Terlambat"
        ){

          terlambat++;

        }

      }

    }

    return {

      success:true,

      totalGuru:
      guru.length,

      hadir:hadir,

      terlambat:
      terlambat,

      belumAbsen:
      guru.length
      -
      hadir

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}

/*************************************************
 *
 * PART 4
 * DASHBOARD & GRAFIK FINAL
 *
 *************************************************/


/*************************************************
 * DASHBOARD ADMIN
 *************************************************/

function getDashboardData(){

  try{

    const statistik =
    getStatistikHariIni();

    const grafik =
    getGrafikBulanan();

    const rekapCepat =
    getRekapCepatGuru();

    return {

      success:true,

      statistik:statistik,

      grafik:grafik,

      rekapCepat:rekapCepat

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * GRAFIK BULANAN
 *************************************************/

function getGrafikBulanan(){

  try{

    const sheet =
    getSheet(
    "Absensi"
    );

    const data =
    sheet
    .getDataRange()
    .getValues();

    const bulanIni =
    Utilities.formatDate(

      new Date(),

      CONFIG.TIMEZONE,

      "MM/yyyy"

    );

    let hadir = 0;
    let terlambat = 0;
    let tidakHadir = 0;

    const guru =
    getGuru();

    for(
      let i=1;
      i<data.length;
      i++
    ){

      const tgl =
      data[i][1];

      if(!tgl) continue;

      const bagian =
      tgl.split("/");

      const bulanData =
      bagian[1] +
      "/" +
      bagian[2];

      if(
        bulanData
        ==
        bulanIni
      ){

        hadir++;

        if(
          data[i][4]
          ==
          "Terlambat"
        ){

          terlambat++;

        }

      }

    }

    tidakHadir = Math.max(
      0,
      (
        guru.data.length * 26
      ) - hadir
    );

    return {

      success:true,

      labels:[

        "Hadir",

        "Terlambat",

        "Tidak Hadir"

      ],

      data:[

        hadir,

        terlambat,

        tidakHadir

      ]

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * REKAP CEPAT GURU
 *************************************************/

function getRekapCepatGuru(){

  try{

    const guru =
    getGuru();

    const absensi =
    getSheet(
    "Absensi"
    )
    .getDataRange()
    .getValues();

    const hasil = [];

    guru.data.forEach(function(g){

      let hadir = 0;

      let terlambat = 0;

      absensi.forEach(function(a,index){

        if(index===0) return;

        if(
          a[2]
          ==
          g.nama
        ){

          hadir++;

          if(
            a[4]
            ==
            "Terlambat"
          ){

            terlambat++;

          }

        }

      });

      const persen =
      hadir > 0

      ?

      (
        (
          hadir
          -
          terlambat
        )
        /
        hadir
        *
        100
      )
      .toFixed(2)

      :

      0;

      hasil.push({

        guru:g.nama,

        hadir:hadir,

        terlambat:
        terlambat,

        persentase:
        persen

      });

    });

    return {

      success:true,

      data:hasil

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * TOP GURU TERBAIK
 *************************************************/

function getTopGuru(){

  try{

    const data =
    getRekapCepatGuru();

    const ranking =
    data.data.sort(

      function(a,b){

        return (

          Number(
          b.persentase
          )

          -

          Number(
          a.persentase
          )

        );

      }

    );

    return {

      success:true,

      data:
      ranking.slice(0,5)

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * DASHBOARD GURU
 *************************************************/

function getDashboardGuru(
token
){

  try{

    const user =
    requireLogin(
    token
    );

    const riwayat =
    getRiwayatAbsensi(
    token
    );

    let hadir = 0;
    let terlambat = 0;

    riwayat.data.forEach(

      function(item){

        hadir++;

        if(
          item.status
          ==
          "Terlambat"
        ){

          terlambat++;

        }

      }

    );

    return {

      success:true,

      nama:user.nama,

      hadir:hadir,

      terlambat:
      terlambat,

      riwayat:
      riwayat.data

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * DATA CHART BULANAN
 *************************************************/

function getChartBulanan(){

  try{

    const absensi =
    getSheet(
    "Absensi"
    )
    .getDataRange()
    .getValues();

    const bulan = {};

    for(
      let i=1;
      i<absensi.length;
      i++
    ){

      const tgl =
      absensi[i][1];

      if(!tgl) continue;

      const p =
      tgl.split("/");

      const key =
      p[1] +
      "/" +
      p[2];

      if(
        !bulan[key]
      ){

        bulan[key] = 0;

      }

      bulan[key]++;

    }

    const labels =
    Object.keys(
    bulan
    );

    const values =
    Object.values(
    bulan
    );

    return {

      success:true,

      labels:labels,

      data:values

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}


/*************************************************
 * DATA DASHBOARD HOME
 *************************************************/

function getHomeDashboard(){

  try{

    const statistik =
    getStatistikHariIni();

    const grafik =
    getGrafikBulanan();

    const topGuru =
    getTopGuru();

    return {

      success:true,

      statistik:
      statistik,

      grafik:
      grafik,

      topGuru:
      topGuru.data

    };

  }
  catch(err){

    return {

      success:false,

      message:
      err.toString()

    };

  }

}
