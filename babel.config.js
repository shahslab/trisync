module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['@tamagui/babel-plugin', { config: './tamagui.config.js' }],
      'react-native-reanimated/plugin',
    ],
  }
}
