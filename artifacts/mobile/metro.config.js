const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);
// The web app intentionally keeps its existing React version. Resolve React
// from the Expo package even when the importing code is a shared workspace lib.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'react' || moduleName.startsWith('react/') ||
      moduleName === 'react-dom' || moduleName.startsWith('react-dom/') ||
      moduleName === 'react-native' || moduleName.startsWith('react-native/')) {
    return context.resolveRequest({ ...context, originModulePath: path.join(__dirname, 'package.json') }, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};
module.exports = config;
