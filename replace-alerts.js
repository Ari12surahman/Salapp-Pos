const fs = require('fs');

const files = [
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(pos)/pos/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(dashboard)/pengaturan/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(dashboard)/warung/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(dashboard)/topup/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(dashboard)/santri/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(auth)/login/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(dashboard)/produk/page.tsx', 
  'c:/Ari/Demo/Sistem Keuangan/Dashboardnya/POS/frontend/src/app/(dashboard)/laporan/page.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let content = fs.readFileSync(f, 'utf8');
    if (content.includes('alert(')) {
      if (!content.includes("import { toast } from 'sonner';")) {
        content = content.replace(/(import .* from .*;)/, "$1\nimport { toast } from 'sonner';");
      }
      
      content = content.replace(/alert\((.*Gagal.*)\)/gi, 'toast.error($1)');
      content = content.replace(/alert\((.*Error.*)\)/gi, 'toast.error($1)');
      content = content.replace(/alert\((.*tidak ditemukan.*)\)/gi, 'toast.error($1)');
      content = content.replace(/alert\((.*salah.*)\)/gi, 'toast.error($1)');
      content = content.replace(/alert\((.*Saldo tidak cukup.*)\)/gi, 'toast.error($1)');
      content = content.replace(/alert\((.*Scan atau ketik.*)\)/gi, 'toast.warning($1)');
      content = content.replace(/alert\((.*Masukkan NIS.*)\)/gi, 'toast.warning($1)');
      content = content.replace(/alert\((.*Berhasil.*)\)/gi, 'toast.success($1)');
      content = content.replace(/alert\((.*berhasil.*)\)/gi, 'toast.success($1)');
      
      // Remaining fallback alerts that weren't matched
      content = content.replace(/alert\(/g, 'toast.info(');
      
      fs.writeFileSync(f, content);
      console.log('Updated', f);
    }
  }
});
