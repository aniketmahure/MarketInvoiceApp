# MarketInvoiceApp

MarketInvoiceApp is an Angular application that can run in a browser for UI development or in Electron for testing local CSV storage.

## Test on macOS with Electron

1. Install Node.js 22.12 or later and npm.
2. In Terminal, go to the project folder and install dependencies:

   ```bash
   cd "/path/to/MarketInvoiceApp"
   npm install
   ```

3. Build the Angular app and launch it in Electron:

   ```bash
   npm run electron
   ```

   The first launch may take a little longer while Electron starts.
4. In the app, create an account and add invoice details. Close the app, launch it again with `npm run electron`, and confirm the account and invoice details are still present.
5. Check the CSV files in Finder at:

   ```text
   ~/Documents/MarketInvoiceApp/accounts/
   ```

   Each account has its own folder containing `account.csv`. The app creates the folders when data is first saved; you do not need to create them manually. The app's general invoice CSV, if used, is `~/Documents/MarketInvoiceApp/invoices.csv`.

To test only the Angular UI in a browser, use `npm start` and open `http://localhost:4200/`. Browser mode uses browser storage and does not test Electron's CSV-file persistence.

## Where app data is stored

CSV files are stored on the device, in a `MarketInvoiceApp` folder inside the operating system's Documents directory:

- macOS: `~/Documents/MarketInvoiceApp/`
- Windows: `%USERPROFILE%\Documents\MarketInvoiceApp\` (the Documents location may be redirected to OneDrive or another managed location)

The `accounts` subfolder contains one folder per account, with its `account.csv`. Back up this `MarketInvoiceApp` folder to preserve the data. Do not store the only copy in the installation folder, because that folder may be replaced during an update.

## Instructions for a Windows user with the app `.exe`

These steps apply after a Windows `.exe` installer or packaged app has been built and provided:

1. Download the `.exe` from the trusted distribution location and run it. If Windows displays a publisher or security warning, verify the download and publisher with the person who provided it before continuing.
2. Complete the installer, then launch MarketInvoiceApp from the Start menu or its desktop shortcut.
3. Create accounts and add invoice details as needed. Data is saved locally; internet access is not required for CSV persistence.
4. To find or back up the CSV files, open File Explorer and enter `%USERPROFILE%\Documents\MarketInvoiceApp\accounts`. If the PC redirects Documents to OneDrive or a work-managed location, look for the `MarketInvoiceApp` folder in that actual Documents location.
5. Before moving to another computer or reinstalling Windows, close the app and copy the entire `MarketInvoiceApp` folder to a safe backup location. Restore it to the Documents folder on the new computer before launching the app.

The repository currently has Electron configured for local development, but does not yet configure Windows installer/`.exe` packaging. A Windows `.exe` must be produced and tested separately before distributing those instructions to end users.

## Other development commands

```bash
npm start  # Run Angular in a browser at http://localhost:4200/
npm run build
npm test
```

For more information about Angular CLI, see the [Angular CLI documentation](https://angular.dev/tools/cli).
