# PostcardCollector – Changelog

Všechny verze jsou čistě klientská single-page aplikace (HTML/CSS/JS, localStorage).
Novější verze jsou nahoře.

---

## [0.6.0] – 2025-11-16  
**Typ verze:** UX & hromadné úpravy

### Přehled / Galerie
- Karty pohlednic nyní zobrazují **UID** (`P000123`) přímo v galerii pro snazší orientaci a hromadné operace.
- V subtoolbaru přibyl indikátor: **„Zobrazeno X / Y pohlednic“** po aplikaci filtrů a hledání.
- Opraven vzhled informačního proužku (`.app-message`), který se nyní zobrazuje pouze při aktivní hlášce a jinak nezabírá místo.

### Detail pohlednice (Přehled)
- Náhledy přední a zadní strany již nejsou ořezané.  
  - Obrázky používají `object-fit: contain` a vždy ukazují **celou pohlednici**, i na mobilu.  
  - Přidána pasparta kolem náhledu pro lepší poměr stran.

### Hromadná úprava (nová funkce)
- Přidáno nové tlačítko **„Hromadná úprava“** pro práci s více vybranými pohlednicemi.
- Nový modal pro batch edit, obsahuje:
  - jednotné nastavení kategorie,
  - hromadnou změnu města, země a roku/období (vyplněné hodnoty se použijí, prázdné se ignorují),
  - přidání tagů (s deduplikací),
  - odebrání tagů (bezpečné mazání vybraných hodnot).
- Po úspěšné hromadné úpravě se seznam znovu vykreslí a výběr se resetuje.

### Klávesové zkratky
- **Ctrl + S / Cmd + S** v modálním detailu nyní uloží změny pohlednice.  
- **Ctrl + Enter** rovněž uloží.  
- **Esc** zavírá modal.  
- Klávesové zkratky jsou aktivní jen při otevřeném modalu a nepřepisují chování aplikace mimo detail.

### Stabilita a UI
- Sjednocení některých textových stylů, zlepšená čitelnost v tmavém režimu.
- Menší úklid ve funkcích spravujících přepínání tabů, ukládání a vykreslování detailu.
- Průběžná optimalizace vykreslování galerie po změnách stavu.

---

## [0.5.1] – 2025-11-15
**Typ verze:** stabilizace + UID systém

- Nový systém generování UID:
  - zachován formát `P000001` atd.,
  - **znovupoužití uvolněných UID** – po smazání pohlednice se nejnižší volné číslo znovu použije,
  - robustní práce i se staršími ID (extrakce číselné části z ID, která nemusí začínat P).
- Přidán set `pendingGeneratedIds` pro práci s dočasně vygenerovanými ID, aby se neblokovala.
- Vylepšená funkce `syncPostcardCounter()` – po načtení dat z localStorage/importu sesynchronizuje čítač s existujícími pohlednicemi.
- Refaktor tabu **„Editace“** v detailu pohlednice:
  - rozumný, vícesloupcový **grid layout** (Základní údaje, Obrázky, Poznámky),
  - pole se už nepřekrývají ani v užším modalu,
  - dva upload boxy pro přední / zadní stranu vedle sebe na desktopu, pod sebou na mobilu,
  - textarea pro poznámky přes celou šířku,
  - řádek pro název souboru (input + „Vygenerovat název“) lépe reaguje na menší šířky.
- Menší úklid a zpřesnění normalizace dat při importu JSON (tagy jako pole, doplnění timestampů).

---

## [0.5.0] – 2025-??-??
**Typ verze:** „Modern UI release“

- Nový **detail pohlednice** v modalu:
  - taby „Přehled“ a „Editace“,
  - velké náhledy přední/zadní strany,
  - přehled základních údajů, tagů a poznámek.
- **Lightbox** pro obrázky (klik na náhled → fullscreen náhled, podpora portrét/landscape).
- Kompletně nový **toolbar + subtoolbar**:
  - vyhledávání,
  - filtrační chipy pro kategorie,
  - filtr „Nekompletní“,
  - tlačítka pro import/export, přidání pohlednice, nastavení motivu.
- **Dark mode** s přepínačem a CSS proměnnými.
- Import / export celé sbírky do JSON (soubor `postcards.json`).
- Indikátor nekompletních pohlednic (chybějící front image / kategorie / město).
- Vylepšené vykreslování galerie (moderní karetní grid, barevné badge kategorií, tagy).

---

## [0.4.x a starší] – shrnutí
První generace aplikace:

- základní gallery view s kartami pohlednic,
- ručně udržovaný JSON se seznamem pohlednic,
- první jednoduchý **UID systém** `P000001` (bez reuse),
- detail pohlednice bez tabů, spíš jako větší karta,
- základní temný motiv a první styling,
- lokální persistence přes localStorage.

Podrobnější historie starších verzí není udržována – od verze 0.5.0 dál se změny zaznamenávají tady.
