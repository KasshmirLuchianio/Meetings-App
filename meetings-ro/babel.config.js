module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
    ],
    // react-native-reanimated v4 split worklets into a separate package.
    // The plugin MUST be the last item in the plugins array.
    plugins: ['react-native-worklets/plugin'],
  };
};
