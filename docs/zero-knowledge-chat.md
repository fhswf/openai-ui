# Zero-Knowledge, geräteübergreifende Chats

Status: Implementierungsplan (Frontend in diesem Repo, Backend-API-Design zur
Umsetzung im Proxy-Backend `fhswf/openai-proxy`).

Dieses Dokument beschreibt, wie Chatverläufe so gespeichert werden, dass der
Server sie **niemals** im Klartext sieht (Zero Knowledge), geräteübergreifend
verfügbar sind und mit anderen Nutzern geteilt werden können.

## 1. Ziele und Nicht-Ziele

Ziele

- Chats geräteübergreifend speichern und laden.
- Vertraulichkeit gegen den Server und gegen Netzwerk-Angreifer. Der
  Server speichert ausschließlich Chiffrat und Schlüssel-Hüllen.
- Teilen eines Chats mit anderen Nutzern, ohne das gesamte Chiffrat neu zu
  verschlüsseln.
- Kein Klartext-Private-Key verlässt jemals das Gerät.
- Wiederherstellung des eigenen Schlüssels auf einem neuen Gerät über den
  Passkey (WebAuthn PRF).
- **Opt-in:** Die zentrale Speicherung ist standardmäßig aus. Schlüsselpaar,
  Passkey und Upload passieren erst, wenn der Nutzer dies im Benutzer-Menü
  aktiv explizit einschaltet. Ohne Opt-in bleibt alles wie bisher lokal.

Nicht-Ziele (bewusste Grenzen)

- Kein Schutz gegen einen kompromittierten Client oder bösartige
  Browsererweiterungen.
- Keine Ende-zu-Ende-Vertraulichkeit gegenüber dem LLM-Anbieter (OpenAI bzw.
  Proxy): Nachrichten werden zum Modell gesendet, dort also im Klartext
  verarbeitet. Zero Knowledge bezieht sich ausschließlich auf die
  **Persistenz**.
- Kein server-seitiges Suchen/Indexieren über den Klartext.

## 2. Bedrohungsmodell

| Angreifer | Kann lesen? | Begründung |
| --- | --- | --- |
| Server-/DB-Betreiber | nein | sieht nur AES-GCM-Chiffrat und RSA-OAEP-Hüllen |
| Netzwerk (TLS-terminierender Proxy) | nein | Klartext existiert nur im Browser |
| Anderer Nutzer ohne Freigabe | nein | besitzt keine Hülle für `K_chat` |
| Nutzer mit Freigabe | ja | besitzt `Enc(PK_empf, K_chat)` |
| Malware/Browser-Extension auf dem Gerät | ja | liegt außerhalb des Modells |

Annahmen: OIDC-Identität ist authentisch; die `credentialId` wird serverseitig
auf die authentifizierte Identität abgebildet; WebAuthn-Assertions werden
serverseitig verifiziert (Passkey ist der Zugang zu `encryptedSK`, nicht der
Sitzungs-Login des OIDC).

## 3. Schlüssel-Hierarchie

```
Passkey (Hardware)  --WebAuthn PRF(salt)-->  IKM (32 Byte)
IKM                 --HKDF-SHA256--------->  K_pass  (AES-GCM-256, KEK)
K_pass              --AES-GCM-------------->  (K_pass schützt SK)
Nutzer-Schlüsselpaar:  PK_user / SK_user     (RSA-OAEP-4096)
                        PK_user  -> Klartext auf Server
                        SK_user  -> mit K_pass verschlüsselt auf Server
Pro Chat:            K_chat                  (AES-GCM-256, zufällig)
                        Chiffrat der Nachrichten mit K_chat
                        Key-Header: Enc(PK_user, K_chat) je Empfänger
```

- `K_pass` ist die Key-Encryption-Key. Sie wird bei jeder Sitzung neu aus dem
  Passkey abgeleitet und nie persistiert.
- `SK_user` (der eigentliche Content-Key) wird mit `K_pass` verpackt
  (`encryptedSK`) und hochgeladen, damit ein neues Gerät ihn wiederherstellen
  kann.
- `K_chat` wird pro Chat zufällig erzeugt. Der Chatverlauf wird damit
  symmetrisch verschlüsselt. Zum Teilen wird nur `K_chat` für jeden Empfänger
  asymmetrisch verpackt (Hybride Verschlüsselung / Multi-Recipient).

## 4. Client-Flow (Frontend, dieses Repo)

### 4.0 Aktivierung: wann entstehen die Schlüssel?

Es gibt **keine** automatische Schlüsselerzeugung. Ohne ausdrückliches Opt-in
passiert gar nichts: kein Passkey, kein Schlüsselpaar, kein Upload. Der Nutzer
aktiviert die Funktion selbst im Benutzer-Menü (Option `general.zkStorage`,
Toggle „Verschlüsselte geräteübergreifende Speicherung“). Erst beim Umlegen
dieses Schalters läuft der Registrierungs-Flow (4.1). Das vermeidet einen
unerwarteten Biometrie-Dialog beim Login und hält das Default-Verhalten
unverändert lokal.

Zustände:

| Zustand | Bedeutung | Verhalten |
| --- | --- | --- |
| `disabled` | Default, kein Opt-in | nur lokale Speicherung |
| `enabled-unlocked` | Opt-in + `SK_user` im IndexedDB vorhanden | Vault aktiv, Klartext-Chats verschlüsselt hoch/runter |
| `enabled-locked` | Opt-in, aber `SK_user` fehlt (neues Gerät) | fragt beim Sitzungsstart nach Passkey (4.2) |

### 4.1 Registrierung / erstes Gerät (nach Opt-in)

1. OIDC-Login ist bereits erfolgt; der Nutzer hat die Funktion im Menü
   aktiviert.
2. Frontend prüft IndexedDB auf `SK_user`. Fehlt er, wird die Einrichtung
   gestartet.
3. Passkey via `navigator.credentials.create()` mit `extensions.prf.eval.first
   = prfSalt` (fester, konfigurierbarer Salt, 32 Byte) anlegen.
4. PRF-Output (`ikm`) via HKDF zu `K_pass` ableiten.
5. `PK_user/SK_user` (RSA-OAEP-4096) erzeugen.
6. `SK_user` (pkcs8) mit `K_pass` (AES-GCM, zufälliger IV) verschlüsseln.
7. `{credentialId, publicKey(spki), encryptedSK, iv}` an das Backend senden.
8. `SK_user` in IndexedDB cachen, Zustand -> `enabled-unlocked`.

Beim Deaktivieren (Toggle aus) wird `DELETE /api/zk/keys/me` angeboten und der
IndexedDB-Cache via `clearPrivateKey()` geleert.

### 4.2 Login auf neuem Gerät

1. OIDC-Login.
2. IndexedDB ist leer -> `GET /zk/keys/me` liefert
   `{credentialId, encryptedSK, iv}`.
3. `navigator.credentials.get()` mit demselben `prfSalt`.
4. PRF-Output -> `K_pass` (identisch zu 4.1).
5. `encryptedSK` mit `K_pass` entschlüsseln -> `SK_user`.
6. `SK_user` in IndexedDB cachen, Chat entsperren.

### 4.3 Chat speichern

1. `K_chat` zufällig erzeugen.
2. `chat`-Objekt serialisieren und mit `K_chat` (AES-GCM) verschlüsseln.
3. `K_chat` mit `PK_user` verpacken -> Hülle für sich selbst.
4. `{id, ciphertext, iv, envelopes:[{recipient, wrappedKey, iv}], metadata}`
   per `PUT /zk/chats/{id}` hochladen.

### 4.4 Chat wiederherstellen

1. `GET /zk/chats` (Liste) bzw. `GET /zk/chats/{id}`.
2. Eigene Hülle mit `SK_user` entpacken -> `K_chat`.
3. Chiffrat mit `K_chat` entschlüsseln -> Chat-Objekt.

### 4.5 Chat teilen

Zum Verpacken von `K_chat` braucht der Absender den **Public Key des
Empfängers**. Da Public Keys nicht geheim sind, ist das ein reines
Discovery-Problem: der Absender muss die stabile `userId` des Empfängers
kennen. Zwei Modelle:

**A. Discovery über den Server (Default, passend zu OIDC/SSO).** Der Server
bietet eine authentifizierte Lookup-Route (siehe 6.1). Ablauf:

1. `GET /zk/keys/lookup?email=<adresse>` -> `{ userId, publicKey }`.
2. `K_chat` lokal mit eigenem `SK_user` entpacken.
3. `K_chat` mit `PK_empf` verpacken (`wrapChatKey`).
4. `POST /zk/chats/{id}/share` mit der neuen Hülle.

Der Lookup muss rate-limitiert und auf bekannte Domains beschränkt sein, damit
keine Nutzer-Enumeration möglich ist. Public Keys sind öffentlich; geschützt
wird, *wer registriert ist*.

**B. Empfänger-initiert (datensparsam).** Ohne globales Verzeichnis teilt der
Empfänger seinen eigenen Public Key, z. B. über einen Teilen-Link
`https://…/#pk=<base64url>` oder durch Einfügen. Der Absender importiert ihn
mit `importPublicKey()` und verpackt `K_chat`. Kein Lookup, keine Enumeration,
aber ein zusätzlicher manueller Schritt.

### 4.6 Migration bestehender lokaler Chats

Beim ersten Entsperren werden vorhandene `CHAT_HISTORY`-Einträge aus
`localStorage` gelesen, verschlüsselt und in den Vault hochgeladen. Erst nach
erfolgreichem Upload werden die Klartext-Einträge entfernt (Feature-Flag,
Opt-in).

## 5. Datenmodell (Server)

Der Server kennt nur Chiffrat und öffentliche Schlüssel.

```
user_keys
  user_id           string  PK
  credential_id     bytes   unique
  public_key        bytes   (SPKI, Klartext)
  encrypted_sk      bytes   (AES-GCM)
  encrypted_sk_iv   bytes
  created_at        ts
  updated_at        ts

chats
  id                uuid    PK
  owner_id          string
  ciphertext        blob    (AES-GCM über den serialisierten Chat)
  iv                bytes
  metadata_ct       blob    (optional: verschlüsselter Titel/Zeit)
  metadata_iv       bytes
  rev               int     (monotone Revision für Konflikte)
  created_at / updated_at

chat_keys                       -- Multi-Recipient Key Header
  chat_id           uuid  FK
  recipient_id      string FK
  wrapped_key       blob  (RSA-OAEP(PK_recipient, K_chat))
  wrapped_key_iv    bytes (nur falls ein AEAD-Wrap verwendet wird)
  is_owner          bool
  created_at        ts
  PK (chat_id, recipient_id)
```

Sichtbarkeitsregel: Ein Nutzer darf einen Chat lesen/ändern, wenn ein
`chat_keys`-Eintrag für ihn existiert. Der Server nutzt das ausschließlich zur
Autorisierung, nicht zur Entschlüsselung.

## 6. Backend-API-Design

Alle Endpunkte unter `/api/zk`. Authentifizierung per OIDC-Bearer-Token bzw.
Session-Cookie (wie der bestehende Proxy). Inhaltstyp `application/json`,
Binärdaten base64url-kodiert. Der Server validiert **niemals** Krypto-Inhalte,
sondern nur Größen, IDs und Berechtigungen.

### 6.1 Nutzerschlüssel

`POST /api/zk/keys/registration-challenge`
-> `{challenge: base64url}` (32 Byte, kurzlebig)

`POST /api/zk/keys`

```
{ credentialId, publicKey, encryptedSk, encryptedSkIv, challenge }
-> 201 { userId, createdAt }
```

`POST /api/zk/keys/assertion-challenge`
-> `{challenge}` (an `credentialId` gebunden)

`POST /api/zk/keys/assertion`

```
{ credentialId, authenticatorData, clientDataJSON, signature }
-> 204
```

`GET /api/zk/keys/me`
-> `{ userId, credentialId, publicKey, encryptedSk, encryptedSkIv }`

`GET /api/zk/keys/{userId}/public-key`
-> `{ userId, publicKey }`

`GET /api/zk/keys/lookup?email=<adresse>` (Discovery zum Teilen)
-> `{ userId, publicKey }`
-> `404 not_found`, wenn die Identität nicht registriert ist

Hinweis: `encryptedSk` wird nur an den Eigentümer ausgeliefert. Andere erhalten
ausschließlich `publicKey`, damit sie einen Chat teilen können. Der Lookup ist
rate-limitiert und auf die eigene(n) OIDC-Domain(s) beschränkt (keine
Nutzer-Enumeration). Alternativ kann auf den Lookup verzichtet und der Public
Key empfänger-initiiert geteilt werden (siehe 4.5 B).

`GET /api/zk/keys/me` liefert `{ registered: false }` mit Status `404`, solange
der Nutzer noch kein Opt-in durchgeführt hat.

`DELETE /api/zk/keys/me`
-> `204` (Opt-out: entfernt Schlüsselmaterial; Vault-Daten bleiben bis zur
expliziten Löschung bestehen und werden dann unzugänglich)

### 6.2 Chats

`GET /api/zk/chats`
-> `[{ id, ownerId, updatedAt, rev }]` (ohne Chiffrat)

`GET /api/zk/chats/{id}`
-> `{ id, ownerId, rev, ciphertext, iv, metadataCt, metadataIv, envelopes:[{recipientId, wrappedKey, wrappedKeyIv}] }`

`PUT /api/zk/chats/{id}`

```
{ ciphertext, iv, metadataCt, metadataIv, selfEnvelope:{wrappedKey, wrappedKeyIv}, baseRev? }
-> 201 neu / 200 aktualisiert
-> 409 { currentRev } bei Konflikt (Last-Write-Wins oder Client-Merge)
```

`POST /api/zk/chats/{id}/share`

```
{ recipientId, wrappedKey, wrappedKeyIv }
-> 201
-> 403 wenn der Aufrufer selbst keine Hülle besitzt
```

`POST /api/zk/chats/{id}/revoke`
```
{ recipientId } -> 204 (Server löscht die Hülle des Empfängers)
```

`DELETE /api/zk/chats/{id}`
-> 204 (nur Owner).

### 6.3 Fehlerformat

`{ "error": { "code": "...", "message": "..." } }` mit
`400 invalid_payload`, `401 unauthenticated`, `403 forbidden`,
`404 not_found`, `409 conflict`, `413 payload_too_large`,
`429 rate_limited`.

### 6.4 Grenzen und Aufbewahrung

- Max. Chiffratgröße z. B. 5 MB pro Chat; größere Inhalte chunked
  (`/chats/{id}/blobs/{n}`).
- `wrappedKey` 256 Byte (RSA-4096), `iv` 12 Byte, `credentialId` < 1024 Byte.
- Rate Limit je Nutzer für Schreibzugriffe.
- Kein serverseitiges Logging von Request-Bodies.

## 7. Sicherheitsbetrachtungen

- **PRF-Salt** ist öffentlich und darf konstant sein; er ist kein Secret.
  Konfigurierbar über eine Konstante, damit er bei Bedarf rotiert werden kann.
- **Passkey erforderlich:** Ohne PRF-Unterstützung wird Zero-Knowledge nicht
  aktiviert; das Feature fällt sauber auf lokale Speicherung zurück.
- **Schlüsselrotation:** `POST /api/zk/keys/rotate` (re-encrypt `SK_user` mit
  neuer `K_pass`, neue `credentialId`). Alle Chats bleiben gültig, da `K_chat`
  nur mit `PK_user` verpackt ist.
- **Verifikation:** Der Server muss WebAuthn-Assertions kryptografisch prüfen.
  Sonst könnte ein Angreifer `encryptedSK` abrufen und offline angreifen. Das
  PRF-Ergebnis selbst verlässt den Authenticator nie, aber der Server darf
  `encryptedSK` nur nach gültiger Assertion herausgeben.
- **Forward Secrecy:** Nicht vorhanden. Bei Verlust des Passkeys sind die
  Chats nicht wiederherstellbar (dokumentiert; optional Recovery-Key).
- **Kein Tracking:** Chiffrat-IDs sind zufällige UUIDs.

## 8. Umsetzungsplan (Frontend, dieses Repo)

1. **Krypto-Modul** `src/chat/utils/zeroKnowledgeCrypto.ts`
   - `deriveKeyFromPrf`, `encryptPrivateKey`, `decryptPrivateKey`
   - `generateChatKey`, `encryptChat`, `decryptChat`
   - `wrapKeyForRecipient`, `unwrapKeyWithPrivateKey`
   - base64url-Helfer, `generateUserKeyPair`.
2. **Passkey-Modul** `src/chat/utils/webauthn.ts`
   - `registerPasskey`, `assertPasskey`, `isPrfSupported`.
3. **Keystore** `src/chat/utils/zeroKnowledgeKeystore.ts`
   - IndexedDB-Cache für `SK_user` (`savePrivateKey`, `loadPrivateKey`,
     `clearPrivateKey`).
4. **Vault-Client** `src/chat/service/chatVault.ts`
   - typisierter API-Client für `/api/zk/...` mit CSRF/Credentials.
5. **Opt-in-Schalter** in `src/chat/ChatOptions.tsx` (Benutzer-Menü)
   - neue Option `general.zkStorage` (Default `false`) in
     `context/types.ts` + `initState.ts` + `utils/options.ts`.
   - Toggle „Verschlüsselte geräteübergreifende Speicherung“: beim Einschalten
     Registrierung/enable, beim Ausschalten Opt-out + `clearPrivateKey()`.
   - Zustandsanzeige des `enabled-locked`-Falls („entsperren“).
6. **Integration** in Chat-Provider/History (Upload beim Speichern, Download
   beim Laden, Share-Aktion mit Public-Key-Discovery) – als Folgeschritt, hier
   vorbereitet.
7. **Tests** unter `src/chat/utils/__tests__` und `src/chat/service/__tests__`
   (Roundtrips, Fehlerfälle, Envelope-Sharing, API-Vertrag).

## 9. Offene Fragen an den Auftraggeber

- Sync-Verhalten: Server als Source of Truth oder Merge mit lokalem
  `localStorage`? (Vorschlag: Server führend, `rev`-basiert.)
- Teilen synchron (Empfänger bereits registriert) oder asynchron via
  Einladungslink? (Design deckt beide ab; nur der Empfänger-Public-Key muss
  vorliegen.)
- Public-Key-Discovery: Server-Lookup (4.5 A, Default) oder empfänger-initiiert
  (4.5 B)? Hängt davon ab, ob ein zentrales Verzeichnis gewünscht ist.
- Optimaler `SK_user`-Algorithmus: RSA-OAEP-4096 (im Kommentar vorgeschlagen)
  oder ECDH P-256/kurvenbasiert (kleinere Hüllen)? Aktuell: RSA-OAEP-4096.
- Aufbewahrung/Recovery bei Passkey-Verlust.
