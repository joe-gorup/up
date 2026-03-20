import { CapacitorConfig } from '@capacitor/cli';

// Set CAPACITOR_APP_URL in your environment to point to the live Replit deployment URL
// e.g. https://your-repl-name.your-username.replit.app
const liveUrl = process.env.CAPACITOR_APP_URL;

const config: CapacitorConfig = {
  appId: 'com.goldenscoop.app',
  appName: 'Golden Scoop',
  // webDir is used for local asset bundling; ignored when server.url is set
  webDir: 'dist/public',
  server: liveUrl
    ? {
        url: liveUrl,
        cleartext: false,
        // Allow navigation within the app's domain
        allowNavigation: [liveUrl.replace('https://', '')],
      }
    : undefined,
  ios: {
    // Respect iOS safe areas (notch, home indicator)
    contentInset: 'automatic',
    // Allow file:// scheme for local fallback builds
    allowsLinkPreview: false,
  },
  android: {
    allowMixedContent: false,
    // Required for Android back button to navigate within webview
    handleExistingPermissionsRequestOnResume: true,
  },
  plugins: {
    // Filesystem plugin — required for iOS file picker support in Job Coach feature
    Filesystem: {
      iosScheme: 'ionic',
    },
  },
};

export default config;
