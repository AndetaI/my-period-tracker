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
│   │         ├── _layout.tsx          # Tab layout
│   │       ├── index.tsx            # Home tab 
│   │       ├── calendar.tsx         # Calendar tab 
│   │       ├── log.tsx              # Daily Log tab 
│   │       └── settings.tsx         # Settings tab
│   ├── db/
│   │   ├── database.ts              # Open/init SQLite DB and inspection helpers
│   │   └── repositories/            # Repository files
│   │      └── cycleRepository.ts       #
│   │      └── dailyRepository.ts       #
│   │      └── periodRepository.ts      #
│   │      └── settingsRepository.ts    #
│   │      └── symptomRepository.ts     #
│   ├── services/
│   │   ├── backupService.ts            # Export/share/save backup
│   │   ├── restoreService.ts           # Pick/validate/restore backup and rollback logic
│   │   └── backupEncryptionService.ts  # Backup encryption implementation
│   │   └── dailyLogService.ts          #
│   │   └── homeService.ts              #
│   │   └── predictionService.ts        #
│   │   └── cycleService.ts             #
│   ├── types/                          # Shared TypeScript types
│   │    └── period.ts                  # interfaces for logs
│   ├── tests/                          # feature testing files
│   │
│   └── utils/                          # Helpers
│   │    └── cycleCalculations.ts   
│   │    └── dateUtils.ts   
│   │    └── periodSelection.ts   
│   │    └── validation.ts   
└── README.md
```

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
| Encrypted backup service | the backup is protected with a password. |

## 4. Database design

The database filename is `period_tracker_v2.db`.

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


## 5. Commands used during development

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

### EAS build and distribution

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

A normal restore has been tested successfully.

### Password-protected backup — implementation verification pending

The backupEncryptionService.ts contains handlers for encrypted export, saving, and restoration, including a minimum 12-character backup-password check. The file's format is `.ptbackup` with authenticated encryption and password-derived keys.

Unencrypted `.db` backups may still be supported; they expose sensitive records to anyone who obtains the file. Store backups securely. Never commit real personal database files, backup passwords, or signing credentials to source control.

## 8. Data safety and privacy

- The primary database is local to the installed application.
- Expo Go and the separately installed development APK have **different app storage**; records do not transfer automatically.
- Export a backup and save an additional copy outside the phone before uninstalling, clearing app data, or switching installations.
- Do not commit personal `.db`/`.ptbackup` files, passwords, `.env` secrets, or signing keys to Git.
- EAS cloud builds upload project sources; personal databases are not included unless they were copied into the project directory or build context.
- A preview APK is a standalone testing/distribution artifact, not a Google Play release. A production AAB and store-policy review are needed before publication.
- Menstrual and ovulation predictions are estimates, not medical advice or a reliable contraception method.


