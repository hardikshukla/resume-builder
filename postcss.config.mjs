/**
 * Intentionally empty. Next.js disables its built-in PostCSS pipeline
 * (autoprefixer, flexbox fixes, preset-env) whenever a PostCSS config file
 * exists, so this file keeps CSS output exactly as authored. Deleting it would
 * change the generated CSS.
 *
 * @type {import('postcss-load-config').Config}
 */
const config = {
  plugins: {},
};

export default config;
