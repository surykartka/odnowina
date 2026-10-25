# Sklep i rezerwacje — konfiguracja

Ten projekt jest statyczną stroną (HTML/CSS/JS) + funkcjami serverless w `/api`
(Node — HotPay, InPost, oraz rezerwacje wizyt). Wymaga wdrożenia na Vercel,
które automatycznie wykryje `/api` jako Serverless Functions.

## 1. HotPay (płatność kartą)

1. Załóż konto na [hotpay.pl/rejestracja](https://hotpay.pl/rejestracja/) i aktywuj je przelewem 10 zł (weryfikacja do 24h).
2. Zarejestruj serwis na [hotpay.pl/przelewy_sklep_nowy](https://hotpay.pl/przelewy_sklep_nowy/) — w panelu znajdziesz **SEKRET** (`HOTPAY_SEKRET`) oraz **hasło** ustawione dla serwisu (`HOTPAY_PASSWORD`).
3. W ustawieniach serwisu w panelu HotPay wklej **adres URL notyfikacji**:
   `https://<adres-wdrożonej-strony>/api/hotpay-webhook` — w przeciwieństwie do
   Przelewy24, HotPay nie przyjmuje tego adresu per-żądanie, trzeba go skonfigurować w panelu.
4. W Vercel → Project Settings → Environment Variables ustaw (patrz `.env.example`):
   - `HOTPAY_SEKRET`, `HOTPAY_PASSWORD`
   - `SITE_URL` — adres wdrożonej strony, np. `https://odnowina.vercel.app`

HotPay nie udostępnia środowiska sandbox w dokumentacji — testy płatności
trzeba robić na realnych (niewielkich) transakcjach lub po konsultacji z
supportem HotPay. Dokumentacja API: [dokumentacja.hotpay.pl](https://dokumentacja.hotpay.pl/).

## 2. InPost Geowidget (wybór paczkomatu)

1. Zarejestruj się na [manager.paczkomaty.pl](https://manager.paczkomaty.pl/) (konto darmowe).
2. Moje konto → API → Geowidget → wygeneruj **publiczny token**.
3. W Vercel → Project Settings → Environment Variables ustaw `INPOST_GEOWIDGET_TOKEN`
   (patrz `.env.example`). Frontend pobiera go przy otwarciu wyboru paczkomatu
   przez `/api/config` (`api/config.js`) — token jest publiczny, więc nie trzeba
   go już wklejać do `app.js`.

To daje klientom wybór realnego paczkomatu przy kasie. Samo nadanie przesyłki
(etykieta) nie jest tu zautomatyzowane — po opłaceniu zamówienia (patrz log w
Vercel → Functions → `hotpay-webhook`) nadajesz paczkę ręcznie w panelu InPost,
na adres wybranego paczkomatu.

## 3. Rezerwacja wizyt (Ziębice / Wrocław)

Kalendarz rezerwacji online korzysta z Upstash Redis do zapisu terminów
(zapobiega podwójnym rezerwacjom tego samego slotu) oraz z Resend do wysyłki
e-maili z potwierdzeniem. Lokalizacja jest wybierana automatycznie na podstawie
dnia tygodnia: **Ziębice** w dni robocze (pon–pt), **Wrocław** w weekendy (sob–nd) —
patrz `lib/booking.js`, jeśli chcesz to zmienić.

1. Załóż darmową bazę na [console.upstash.com](https://console.upstash.com/) (Redis),
   skopiuj **REST URL** i **REST Token**.
2. Załóż konto na [resend.com](https://resend.com/), wygeneruj **API key** i
   zweryfikuj domenę nadawcy (albo użyj `onboarding@resend.dev` do testów).
3. W Vercel → Project Settings → Environment Variables ustaw:
   - `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
   - `RESEND_API_KEY`, `RESEND_FROM` (np. `Odnowina <rezerwacje@twojadomena.pl>`)
   - `OWNER_EMAIL` — adres, na który ma przychodzić powiadomienie o nowej rezerwacji (opcjonalnie)

Bez `RESEND_API_KEY` rezerwacja i tak się zapisze (slot zostaje zablokowany w
Redis) — po prostu nie wyśle się e-mail z potwierdzeniem.

## 4. Baza zamówień i rezerwacji

Zamówienia ze sklepu (koszyk, dane klienta, paczkomat, status płatności) oraz
rezerwacje wizyt są trwale zapisywane w tej samej bazie Upstash Redis co w
punkcie 3 — to w pełni bezserwerowe (REST API, bez własnego procesu bazy
danych do uruchamiania/utrzymywania). Zamówienie zapisuje się jako `pending`
przy rejestracji transakcji w HotPay (`api/create-transaction.js`), a
webhook `hotpay-webhook` zmienia status na `paid` i wysyła e-maile z
potwierdzeniem do klienta i do sklepu (`OWNER_EMAIL`).

## 5. Panel admina

Pod adresem `/admin.html` jest prosty panel do przeglądania rezerwacji i
zamówień oraz:
- odwoływania rezerwacji (zwalnia termin do ponownej rezerwacji),
- oznaczania zamówień jako wysłane albo odwołane.

Dostęp chroni jedno wspólne hasło:

1. W Vercel → Project Settings → Environment Variables ustaw `ADMIN_PASSWORD`
   (długie, losowe hasło).
2. Wejdź na `/admin.html` i zaloguj się tym hasłem.

Hasło jest wysyłane w nagłówku `x-admin-key` do funkcji w `/api/admin/*` —
nie ma systemu kont/ról, więc nie udostępniaj hasła osobom, którym nie
ufasz z dostępem do danych klientów.

## 6. Wdrożenie

```
npm i -g vercel
vercel
```

Po wdrożeniu ustaw zmienne środowiskowe w panelu Vercel i zrób redeploy
(`vercel --prod`), żeby funkcje w `/api` je zobaczyły.

## Ograniczenia tego MVP

- Zamówienia i rezerwacje są teraz trwale zapisywane (punkt 4) i widoczne w
  panelu admina (punkt 5), wraz z e-mailami z potwierdzeniem do klienta i do
  sklepu. Nadanie przesyłki samo się nie dzieje — po opłaceniu zamówienia
  (status `paid` w panelu) nadajesz paczkę ręcznie w panelu InPost, na adres
  wybranego paczkomatu. Opcjonalnie można to zautomatyzować przez InPost
  ShipX API (wymaga konta biznesowego InPost).
- Panel admina ma jedno wspólne hasło, bez kont/ról/audytu — wystarczające dla
  jednej osoby/sklepu, ale nie dla większego zespołu.
