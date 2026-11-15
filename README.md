# ATO — Period Tracker

A privacy-focused menstrual cycle tracking application built with **React Native**, **Expo Router**, **TypeScript**, and **SQLite**. The application is being developed incrementally and tested on Android.

## 1. Features

- **Home:** current-cycle overview, current-week navigation, cycle history.
- **Calendar:** select dates and add, edit, or delete period entries.
- **Log:** record period status, flow, mood, symptoms, and notes for a selected date.
- **Settings:** manage expected cycle length and expected period duration.
- **Local storage:** SQLite database on the device.
- **Backup:** export/share a database copy or save it to a selected Android folder.
- **Restore:** select and validate a database backup, then restore it with a recovery-copy mechanism.

## 2. Technology stack

| Technology | Purpose |
| --- | --- |
| React Native | Native mobile UI |
| Expo SDK 58 | Application framework and native-module integration |
| Expo Router | File-based screen routing and tabs |
| TypeScript / TSX | Typed application logic and UI components |
| `expo-sqlite` | Persistent local relational database |
| `expo-file-system` | Backup file operations |
| `expo-file-system/legacy` | Android Storage Access Framework operations in existing backup implementation |
| `expo-document-picker` | Select backup files for restoration |
| `expo-sharing` | Share exported backups |
| `expo-dev-client` | Custom development application with native dependencies |
| `react-native-quick-crypto` | Installed/planned native cryptographic primitives for encrypted backups |
| EAS Build | Cloud builds for Android APK/AAB and iOS IPA |

## 3. Architecture

The application follows a lightweight layered structure:

```text
UI screens (Expo Router tabs)
       |
       v
Application logic / services
       |
       v
Repositories and database helpers
       |
       v
SQLite database in the installed app’s private device storage

Backup flow: SQLite -> backup service -> .db file -> Share / Save
Restore flow: Document Picker -> validation -> SQLite restore -> integrity checks
Encrypted backup code path: SQLite -> password-protected backup -> .ptbackup 
```

### Main folders and files

```text
my-period-tracker/
├── app.json                         # Expo app configuration, Android package, plugins
├── eas.json                         # EAS development/preview/production build profiles
├── package.json                     # Dependencies and npm scripts
├── package-lock.json                # Locked npm dependency versions
├── tsconfig.json                    # TypeScript options and @/* path aliases
├── assets/images/ATO.png           # ATO flower icon / splash image
├── src/
│   ├── app/
│   │   ├── _layout.tsx              # Root routing/navigation setup
│   │   └── (tabs)/
            ├── _layout.tsx          # Tab layout
│   │       ├── index.tsx            # Home tab 
│   │       ├── calendar.tsx         # Calendar tab 
│   │       ├── log.tsx              # Daily Log tab 
│   │       └── settings.tsx         # Settings tab
│   ├── db/
│   │   ├── database.ts              # Open/init SQLite DB and inspection helpers
│   │   └── ...                      # Repository files

│   ├── services/
│   │   ├── backupService.ts            # Export/share/save backup
│   │   ├── restoreService.ts           # Pick/validate/restore backup and rollback logic
│   │   └── backupEncryptionService.ts  # Backup encryption implementation
│   ├── types/                          # Shared TypeScript types
        └── period.ts                   # 
│   └── utils/                          # Helpers
└── README.md
```

**Expo Router note:** Some projects use a root-level `app/` folder rather than `src/app/`. The location above reflects the path discussed for the current Settings screen; verify it in the actual repository.

### What the key files do

| File | Responsibility |
| --- | --- |
| `app.json` | App name, slug, scheme, icons, native Expo plugins, Android application ID, EAS project ID. |
| `eas.json` | Controls whether an EAS build is a development client, preview APK, or production build. |
| `tsconfig.json` | Enables strict TypeScript and resolves imports such as `@/db/database` to `src/db/database`. |
| `src/app/_layout.tsx` | Defines root navigation and screen layout. |
| `src/app/(tabs)/...` | Implements tab screens, forms, interactions, and UI state. |
| `src/db/database.ts` | Opens the SQLite database, initializes schema, and exposes database access. |
| Repository modules | Encapsulate SQL reads/writes, where implemented. |
| `src/services/backupService.ts` | Copies the live SQLite database to a backup database, checks integrity, and shares/saves it. |
| `src/services/restoreService.ts` | Picks and validates a backup, applies it, and attempts to recover the previous database on failure. |
| Encrypted backup service | Recent Settings code calls encrypted export/save/restore; confirm the exact service filename and test the full flow. |

## 4. Database design

The database filename previously documented is `period_tracker_v2.db`. Confirm the active name in `src/db/database.ts` before relying on it for manual backup or debugging.

| Table | Intended purpose |
| --- | --- |
| `cycles` | Cycle-level history and timing |
| `periods` | Period start/end records |
| `daily_logs` | Daily period/flow/notes and other log data |
| `symptoms` | Available symptom definitions |
| `daily_log_symptoms` | Many-to-many link between logs and symptoms |
| `ovulation_estimates` | Estimated or manually managed ovulation information |
| `user_settings` | Cycle length, expected period duration, and related preferences |
| `schema_migrations` | Records applied database schema versions |

The initial migration version is `1` (`initial_schema`). The application checks database integrity and foreign-key consistency during backup/restore.

**Important:** Cycle and ovulation estimates should be treated as estimates, not medical diagnoses or contraception guidance.

## 5. Commands used during development

Run these in **PowerShell** from the project root (`C:\Users\Ani\Documents\my-period-tracker` in the current setup).

### Start and check the app

```powershell
npx expo start                 # Start Metro / Expo development server
npx expo start --clear         # Start Metro after clearing its cache
npx expo start --dev-client    # Connect the installed Android development build
npx tsc --noEmit               # Type-check TypeScript without generating files
npx expo-doctor                # Check Expo project/dependency health
npx expo-doctor --verbose      # Detailed Expo Doctor diagnostics
npx expo install --check       # Check SDK-compatible package versions
npx expo install --fix         # Fix SDK package-version mismatches
```

### Dependencies and diagnostics

```powershell
npx expo --version                          # Expo CLI version
npm list expo expo-crypto expo-file-system # Inspect installed Expo packages
npx expo install expo-dev-client           # Install Expo development client
npm install react-native-quick-crypto      # Install native cryptography package
npm audit                                  # Inspect reported dependency vulnerabilities
```

Do **not** automatically use `npm audit fix --force`: it may install breaking versions. Review `npm audit` findings first.

### EAS build and distribution

The project is already linked to an Expo EAS project. Its Expo display name is **ATO**, slug is **`ato`**, and Android application ID is **`com.myperiodtracker.app`**. Keep the current `extra.eas.projectId` generated by `eas init`; do not restore the older project ID from the previous slug.

```powershell
eas login
eas build --platform android --profile preview      # Standalone APK, install directly
eas build:list --platform android --limit 3          # Check build status
eas build --platform android --profile production   # Play Store AAB (default)
eas build --platform ios --profile preview           # iOS internal build; Apple signing required
eas build --platform ios --profile production        # App Store release build
```

The current `eas.json` profiles are:

| Profile | Configuration | Intended use |
| --- | --- | --- |
| `development` | Development client, internal distribution, Android APK | Live development with Metro |
| `preview` | Internal distribution, Android APK | **Standalone ATO** for installation and sharing with Android testers |
| `production` | `autoIncrement: true`, default Android AAB | Store release after testing and policy checks |

**Preview is a real standalone app.** After installation it does not require VS Code, Expo Go, Metro, or internet for locally implemented features. A preview APK can be shared with Android friends using the completed EAS build's installation URL/QR code. An Android APK **cannot** be installed on iOS.

For iOS, EAS can build from Windows, but installing an internally distributed IPA on a real iPhone normally requires Apple Developer Program enrollment, signing/provisioning, and device registration (`eas device:create`). For public distribution, prepare an App Store production build and submit through App Store Connect.

For Google Play, prepare a production AAB, store screenshots/description, privacy policy, health-app declarations, and any required testing. Do not assume a successful EAS build means store approval.

### Icon and splash configuration

`app.json` points `icon`, `ios.icon`, Android adaptive `foregroundImage`, web favicon, and the splash-screen image at `./assets/images/ATO.png`. The Android adaptive icon uses background color `#FFF5F8`. Because the source image has a square background, some Android launchers may crop or scale it awkwardly. If needed, make a transparent, padded flower-only foreground (e.g. `assets/images/ATO-foreground.png`) and point only `android.adaptiveIcon.foregroundImage` to that asset. **Rebuild and reinstall the APK** for icon/splash changes to appear; changing `app.json` alone will not alter an installed build.

### Validation status

- `npx expo-doctor`: **20/20 checks passed** after `npx expo install --fix`.
- `npx tsc --noEmit`: **passed**.
- Editor-only JSX errors were resolved by reloading/restarting the TypeScript tooling.
- `npm install` reported **3 high-severity audit findings**; inspect with `npm audit` rather than blindly applying `npm audit fix --force`.
- EAS Android preview build: **submitted, last observed queued**. No finished artifact or successful installation confirmed yet.

## 6. Development and installed-app workflow

1. Open the project in VS Code and run `npx expo start` for supported development workflows; use `--dev-client` when testing with a development-client build.
2. Edit TypeScript/TSX screens, services, or repositories; verify with `npx tsc --noEmit` and `npx expo-doctor`.
3. For an **installed preview APK**, changes to local source files do **not** automatically reach the phone. Create a **new preview build** and install it as an update.
4. To preserve existing local SQLite records during an Android update, keep the same package ID and signing key, and ensure the Android version code increases. Schema migrations must preserve existing data.
5. To test the app offline, close the development tools and turn off network access; verify Home, Calendar, Log, Settings, persistence, and predictions.

Expo Go, a development client, and the standalone APK use distinct application storage. Data entered in Expo Go is **not automatically copied** into ATO's standalone database.

## 7. Backup and restore

### Existing unencrypted backup

1. The backup service creates a separate SQLite database copy with `SQLite.backupDatabaseAsync`.
2. It verifies `PRAGMA integrity_check` and `PRAGMA foreign_key_check`.
3. The backup can be shared or saved to a chosen Android folder.
4. Restore uses the document picker, opens the selected `.db` file, and validates required tables and migration compatibility.
5. Before applying a restore, the app creates a recovery copy of the current database.
6. If restore fails, the service attempts rollback to that recovery copy.

A normal restore has been tested successfully. **The failure-and-rollback path still needs a controlled test.** Do not test destructive failures using irreplaceable records.

### Password-protected backup — implementation verification pending

Recent Settings code contains handlers for encrypted export, saving, and restoration, including a minimum 12-character backup-password check. The intended format is `.ptbackup` with authenticated encryption and password-derived keys. **Do not mark encryption as fully verified until a standalone-build round-trip test succeeds**, including correct password, wrong password, corrupted file, and restoring an existing database without data loss.

Unencrypted `.db` backups may still be supported; they expose sensitive records to anyone who obtains the file. Store backups securely. Never commit real personal database files, backup passwords, or signing credentials to source control.

## 8. Data safety and privacy

- The primary database is local to the installed application.
- Expo Go and the separately installed development APK have **different app storage**; records do not transfer automatically.
- Export a backup and save an additional copy outside the phone before uninstalling, clearing app data, or switching installations.
- Do not commit personal `.db`/`.ptbackup` files, passwords, `.env` secrets, or signing keys to Git.
- EAS cloud builds upload project sources; personal databases are not included unless they were copied into the project directory or build context.
- A preview APK is a standalone testing/distribution artifact, not a Google Play release. A production AAB and store-policy review are needed before publication.
- Menstrual and ovulation predictions are estimates, not medical advice or a reliable contraception method.

## 9. Troubleshooting

| Problem | Check |
| --- | --- |
| VS Code underlines `expo/tsconfig.base` | Run `npx tsc --noEmit`; if clean, reload VS Code (`Developer: Reload Window`). |
| Expo Doctor reports patch mismatches | Run `npx expo install --fix`, then `npx expo-doctor`. |
| Expo Go cannot load native crypto | Use the installed EAS development build instead. |
| Changes do not appear on phone | Development client: check Metro/Fast Refresh. Preview APK: build and install a new APK. |
| EAS build is queued | Free Tier queue time is variable; wait for a worker. You can close VS Code without cancelling the cloud build. |
| Android icon is cropped | Use a transparent padded adaptive foreground and rebuild. |
| Friend has an iPhone | Android APK will not install; build and sign an iOS IPA separately. |
| EAS build fails during Gradle | Read the Gradle error section of the EAS build logs. |
| `npm audit` reports vulnerabilities | Inspect `npm audit` and assess affected runtime/dev dependencies before updating. |
| Restore cannot open a selected file | Check document-picker URI access and the `expo-file-system` / legacy file-info handling. |

## 10. Next milestones

1. Wait for the Android **preview** build to finish, download its APK, and install ATO on a physical Android phone.
2. Verify app icon and splash screen, offline use, all four tabs, saving/editing/deleting periods, immediate prediction refresh, and SQLite persistence after restart.
3. Test export and restore on disposable data, including encrypted backup flows and controlled rollback failures.
4. Fix any icon scaling with a transparent adaptive foreground and generate a new APK if needed.
5. Test the same code on iOS with appropriate Apple signing/device provisioning.
6. Prepare privacy policy, data-safety disclosures, health-app declarations, screenshots, and production AAB/IPA before publishing to stores.

---

**Maintenance:** Update this README whenever app configuration, dependencies, schema, backup format, or build status changes. Folder paths are an architectural overview; check actual filenames in the project before copying commands or imports.
