/**
 * Expo config plugin — injects adi-registration.properties into
 * android/app/src/main/assets/ during prebuild.
 *
 * Required by Google Play for package-name verification (ADI token).
 * Works with both local `expo prebuild` and EAS cloud builds.
 */
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const ADI_TOKEN = 'CRXZTBDGY5HYQAAAAAAAAAAAAA';
const ADI_FILENAME = 'adi-registration.properties';

const withAdiRegistration = (config) => {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const assetsDir = path.join(
        cfg.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'assets'
      );
      // Ensure the assets directory exists
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }
      const filePath = path.join(assetsDir, ADI_FILENAME);
      fs.writeFileSync(filePath, ADI_TOKEN, 'utf8');
      console.log(`[withAdiRegistration] Wrote ${filePath}`);
      return cfg;
    },
  ]);
};

module.exports = withAdiRegistration;
