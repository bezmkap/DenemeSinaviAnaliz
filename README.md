# DenemeSinaviAnaliz

Okulların eğitim yılı boyunca yaptığı **LGS**, **TYT** ve ileride **AYT** süreç değerlendirme sonuçlarını yükleyip okul içinde değerlendirmesi için web uygulaması.

## Cursor IDE’de açma (yerel)

Bu proje sizin Windows makinenizde `yksanaliz` ile **kardeş klasör** olarak çalışacak şekilde hazırlanmıştır. Cloud ajanındaki Önizleme, sizin `localhost` adresiniz değildir; yerelde çalıştırmak için depoyu kendi bilgisayarınızda açın.

1. Bu ajan ekranındaki **Create repo** (Depo oluştur) düğmesine tıklayın.
2. Adı tam olarak `DenemeSinaviAnaliz` yapın, görünürlüğü **private** seçin.
3. Cursor’da **File → Open Folder** ile `yksanaliz` klasörünün yanındaki `DenemeSinaviAnaliz` klasörünü açın.  
   Örnek: `yksanaliz` `C:\Users\Meb\Projects\yksanaliz` ise hedef `C:\Users\Meb\Projects\DenemeSinaviAnaliz` olmalıdır.
4. Terminalde:

```powershell
cd C:\Users\Meb\Projects\DenemeSinaviAnaliz
copy .env.example .env.local
npm install
npm run dev
```

5. Tarayıcıda `http://127.0.0.1:43145/giris` adresini açın.

Node.js 20 veya üzeri gerekir. `yksanaliz` reposuna dokunmayın.

### Demo girişleri

Parola: `Demo1234!`

| E-posta | Rol |
| --- | --- |
| `okul.a@demo.okul` | Atatürk Ortaokulu — LGS paneli |
| `yonetici@demo.okul` | Sistem yöneticisi |
| `okul.b@demo.okul` | Yalnızca Okul Özeti |
| `okul.c@demo.okul` | Modül kapalı ekranı |

## Çalıştırma (özet)

```bash
npm install
cp .env.example .env.local
npm test
npm run dev
```

macOS / Linux için `cp`, Windows PowerShell için `copy` kullanın. Geliştirme sunucusu `http://127.0.0.1:43145` adresindedir.

Supabase anahtarları olmadan uygulama **yerel demo deposu** ile açılır.


## Yetenekler

- Kurum kodu ile okul tanımlama (ad, il, ilçe, tür, sınav yetkisi)
- Okul kullanıcısı yalnızca bağlı olduğu kurumun öğrencilerini görür
- LGS ve TYT Excel içe aktarma; AYT için eklenebilir importer iskeleti
- Kaynak net (`_N`) ile kurala göre hesaplanan netin ayrı saklanması
- TYT dosyasındaki yinelenen `sosyal_*` sütunlarının “Muhtemel Matematik” olarak onaylatılması
- Analiz modüllerinin tüm okullara, seçilen okullara veya tek okula açılıp kapatılması
- Kapalı modülün menüde gizlenmesi; URL ve API erişiminin reddedilmesi
- Yükleme denetim kaydı ve yöneticinin hatalı yüklemeyi geri alması

## Excel biçimi

Dosyada `TopluSonuc` sayfası aranır. Sınav adı, tarihi, akademik yıl, yayınevi ve sınav kodu dosyada yoktur; yükleme formunda zorunludur.

Örnek (anonim) dosyayı uygulamadaki “Örnek LGS / TYT” bağlantılarından indirebilirsiniz. Gerçek öğrenci dosyalarını repoya eklemeyin.

LGS dersleri: Türkçe, İnkılap Tarihi, Din Kültürü, İngilizce, Matematik, Fen.

TYT dersleri: Türkçe, Sosyal Bilimler, Temel Matematik, Fen Bilimleri. İkinci `sosyal_*` grubu otomatik matematik sayılmaz.

Net kuralları yapılandırılabilir:

- LGS: `Doğru − Yanlış / 3`
- TYT: `Doğru − Yanlış / 4`

Öğrenci numarası ve kurum kodu **metin** olarak saklanır; baştaki sıfırlar korunur. Öğrenci eşlemesi ad ile yapılmaz; kurum + akademik yıl + kaynak öğrenci numarası kullanılır. T.C. kimlik numarası istenmez.

Kurum kodu veritabanında yoksa satır sessizce kabul edilmez; satır numarasıyla hata gösterilir. Okul kullanıcısının dosyasında başka kurum kodu varsa yüklemenin tamamı reddedilir.

## Supabase

1. Projeyi oluşturun, Authentication’ı açın.
2. `supabase/migrations/0001_init.sql` dosyasını SQL Editor’de çalıştırın veya `supabase db push` kullanın.
3. İsteğe bağlı anonim kurumlar için `supabase/seed.sql` dosyasını çalıştırın.
4. `.env.local` içine URL, anon key ve **yalnızca sunucu** service role anahtarını yazın.
5. Auth kullanıcılarını oluşturup `profiles` ve `memberships` tablolarına bağlayın.

Şema; kurum, profil, üyelik, akademik yıl, sınav oturumu, öğrenci, genel/ders sonuçları, yükleme, hata, analiz modülü, kurum izinleri ve işlem kayıtlarını içerir. Tüm kuruma bağlı tablolarda RLS açıktır. İstemciden gelen `institution_id` değerine güvenilmez; üyelik kaydı esas alınır. Service role anahtarı tarayıcıya gönderilmez.

Anahtarlar yokken geliştirmeyi durdurmayın: uygulama demo deposuyla çalışır.

## Vercel

Next.js App Router projesi olduğu için Vercel’e doğrudan bağlanabilir.

1. GitHub’daki `DenemeSinaviAnaliz` deposunu içe aktarın.
2. Ortam değişkenlerini (`.env.example` ile aynı adlar) tanımlayın.
3. Production’da `DEMO_MODE=false` ve gerçek `SESSION_SECRET` kullanın.

## Test

```bash
npm test
npm run lint
npm run typecheck
```

Testler anonim veriyle şunları doğrular: kurum izolasyonu, kapalı modül, yönetici yetkisi, baştaki sıfırlar, bilinmeyen kurum kodu, TYT yinelenen sütun onayı, net uyuşmazlığı, mükerrer yükleme, okul kullanıcısının yabancı kurum satırını yükleyememesi, LGS/TYT importer ayrımı.

## Gizlilik

Gerçek öğrenci listelerini, yüklenen `.xlsx` dosyalarını, `.env` ve Supabase anahtarlarını GitHub’a göndermeyin. `.gitignore` bu dosya türlerini dışlar.
