# Gross Board Telegram bot

Google Sheets'dagi Gross Board jadvalini o'qiydigan bot. Vercel'da bepul, 24/7 ishlaydi.

## Bot nima qiladi

| Buyruq | Nima qiladi |
|---|---|
| `/hisobot scott noyabr` | Yuklar soni, gross, RPM, status, yuklar ro'yxati va haftalik grafik |
| `/foiz scott noyabr` | 1% / 1.7% / 2% tugmalari; tanlanganiga qarab oylik ulush va grafik |
| `/grafik noyabr` | Dispetcherlarni taqqoslash grafigi |
| `/yil scott` | Oyma-oy gross grafigi |
| `/xatolar noyabr` | Month bo'sh, dispetcher yozilmagan, status yo'q qatorlar |
| `/yangila` | Jadvalni darhol qayta o'qish (odatda 1 daqiqa kesh) |
| `1955571` | Bitta load raqami: o'sha yukni topadi |
| Bir nechta load (har biri yangi qatorda) | Jadval bilan solishtiradi: yo'qlari, xatolari, summa farqi |

Ism yozilmasa `DEFAULT_DISPATCHER`, oy yozilmasa joriy oy olinadi.

### Hisoblash qoidalari

- Oy **Month** ustunidan olinadi. U bo'sh bo'lsa, **Date** ustunidagi oy olinadi va bot buni ⚠️ bilan belgilaydi.
- Dispetcher ismidagi ortiqcha bo'sh joy va katta-kichik harf hisobga olinmaydi ("Scott " = "Scott").
- Dispetcheri yozilmagan qo'shimcha qator (masalan, LAYOVER) o'sha load raqamining dispetcheriga qo'shiladi.
- Status = Cancelled bo'lgan yuklar grossga kirmaydi.

## O'rnatish (taxminan 15 daqiqa)

### 1. Telegram bot yaratish
1. Telegram'da **@BotFather** ga `/newbot` yozing, bot nomini bering.
2. U bergan **token**ni saqlab qo'ying (`123456:ABC...` ko'rinishida).

### 2. Google Sheets'ni tayyorlash
1. Gross Board jadvalini Google Sheets'ga yuklang (yoki mavjudini oching).
2. **Share → General access → "Anyone with the link" → Viewer** qiling.
   Jadval faqat havolani biladigan odamga ko'rinadi. Havolani hech kimga bermang.
3. Havoladan ikkita narsani oling:
   `https://docs.google.com/spreadsheets/d/`**`SHEET_ID`**`/edit#gid=`**`SHEET_GID`**
   (`2026` varag'ini ochib turib havolani nusxalang, shunda `gid` to'g'ri bo'ladi.)

### 3. Vercel'ga joylash
1. https://vercel.com da GitHub orqali ro'yxatdan o'ting (bepul Hobby reja yetadi).
2. Ushbu papkani GitHub'da yangi **private** repository qilib yuklang.
3. Vercel'da **Add New → Project** → shu repository'ni tanlang.
4. **Environment Variables** bo'limiga quyidagilarni qo'shing:

| Nomi | Qiymati |
|---|---|
| `BOT_TOKEN` | BotFather bergan token |
| `SHEET_ID` | 2-qadamdagi SHEET_ID |
| `SHEET_GID` | 2-qadamdagi gid (masalan `0`) |
| `DEFAULT_DISPATCHER` | `Scott` |
| `WEBHOOK_SECRET` | O'zingiz o'ylab topgan uzun so'z, faqat harf va raqam (masalan `gb2026xYz81kq`) |
| `ALLOWED_USERS` | Hozircha bo'sh qoldiring (5-qadamda to'ldirasiz) |

5. **Deploy** tugmasini bosing.

### 4. Botni ulash
Brauzerda bir marta oching (o'zingizning manzil va secret bilan):
```
https://SIZNING-LOYIHA.vercel.app/api/setup?key=WEBHOOK_SECRET
```
Javobda `"ok": true` chiqsa, tayyor.

### 5. Ruxsat berish
1. Botga `/start` yozing. U sizning **Telegram ID**ingizni ko'rsatadi.
2. Vercel → Settings → Environment Variables → `ALLOWED_USERS` ga shu ID ni yozing.
   Bir nechta odam bo'lsa, vergul bilan yozing: `123456,789012`.
3. Vercel → Deployments → oxirgisi → **Redeploy**.
4. Botga `/help` yozing.

## Jadval tuzilishi
Bot 1-qatordagi sarlavhalarni nomidan topadi: `Status, Date, Broker, Load ID, Facility Sequence,
Driver Name, Truck #, Loaded Miles, Revenue, Total Distance, Week, Note, Dispatcher, Month`.
Ustunlar tartibi o'zgarsa ham ishlaydi, lekin nomlarini o'zgartirmang.

## Mahalliy sinov
```
npm install
node test/run.js jadval.csv ./chiqish '[{"t":"/hisobot scott noyabr"}]'
```
