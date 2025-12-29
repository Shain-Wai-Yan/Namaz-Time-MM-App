# Namaz Times MM (Android Version) 🕋

A minimalist, high-precision prayer time application designed for the Myanmar community and users worldwide.  
This version is a dedicated Android build powered by Next.js and Capacitor.

## 🌟 Features

- **Offline-First**: Uses astronomical solar equations to calculate prayer times locally on your device. No external APIs required.
- **Robust Geolocation**: Optimized for mobile with a 30-second GPS timeout and 1-hour location caching to ensure reliability even indoors or without data.
- **Bilingual Support**: Full support for English and Burmese (Myanmar) languages.
- **Luxury Minimalist UI**: A clean, architectural design with deep emerald green accents on a pure white background.
- **Customizable Calculations**: Supports multiple calculation methods (defaulting to Karachi) and Asr shadow rules (Hanafi/Shafi).

## 🛠 Technical Details

- **Framework**: Next.js 15 (App Router)
- **Bridge**: Capacitor (Native Geolocation & Asset Management)
- **Styling**: Tailwind CSS
- **Output**: Static HTML Export (`output: 'export'`)
- **Calculation Logic**: Custom implementation of solar position equations based on latitude, longitude, and Julian days

## 🚀 Build Steps

To set up the development environment or build the APK, run these commands in order.

### Install Dependencies

npm install

### Generate Web Assets  
(Creates the `/out` folder required by Capacitor)

npm run build

### Sync with Android  
(Copies the web assets into the Android source code)

npx cap sync

### Open in Android Studio

npx cap open android

## 🎨 Branding & Assets

To update the app icon or splash screen, place your high-resolution logo (for example `logo.png`) in the `/assets` folder and run:

npx capacitor-assets generate --android

## 💡 Important Configuration Tips & Reminders

### 1. The `out` Folder Rule

Capacitor is configured to look for a folder named `out`.  
If you do not see your changes in the Android emulator, it is usually because `npm run build` was not executed before syncing.

### 2. Location Logic (Critical for Offline)

To ensure the app works in buildings or without internet access, the geolocation code in `page.tsx` must use the following settings:

- `enableHighAccuracy: true` — Forces the GPS hardware to wake up
- `maximumAge: 3600000` — Allows using a location from the last hour if a new one cannot be found immediately
- `timeout: 30000` — Gives the GPS enough time (30 seconds) to find satellites

### 3. Git Hygiene

Your `.gitignore` should always exclude the following to prevent the repository from becoming unnecessarily large:

/android/app/build/
/android/.gradle/
/android/local.properties
/node_modules/
/.next/
/out/

### 4. Static Export Limitations

Because `output: 'export'` is enabled in `next.config.mjs`:

- Image optimization is not available  
  Use the standard `<img>` tag or set `unoptimized: true`
- Server-side features will not work  
  This includes Middleware, Cookies, and Server Actions

### 5. App Identity

To change the name shown on the phone home screen:

- Update `appName` in `capacitor.config.ts`
- Update `<string name="app_name">` in  
  `android/app/src/main/res/values/strings.xml`
  to change the app icon use command 
  - npx capacitor-assets generate --android _

## 👨‍💻 About the Creator

Created by **Shain Wai Yan (Muhamadd Xolbine)**.  
This project is a personal effort to combine faith, mathematics, and thoughtful engineering into a practical daily tool.  
The belief behind the project is simple: technology should be simple, accurate, and meaningful.

## 📄 License

Personal Project — All Rights Reserved