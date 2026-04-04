const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function fixFollyCoroutines(config) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let podfileContent = fs.readFileSync(podfilePath, "utf-8");

      const fixCode = `
  post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_HAVE_COROUTINES=0'
      end
    end
  end`;

      if (podfileContent.includes("post_install")) {
        podfileContent = podfileContent.replace(
          /post_install do \|installer\|/,
          `post_install do |installer|
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |bc|
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] ||= ['$(inherited)']
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_CFG_NO_COROUTINES=1'
        bc.build_settings['GCC_PREPROCESSOR_DEFINITIONS'] << 'FOLLY_HAVE_COROUTINES=0'
      end
    end`
        );
      } else {
        podfileContent = podfileContent.replace(
          /^end\s*$/m,
          fixCode + "\nend"
        );
      }

      fs.writeFileSync(podfilePath, podfileContent);
      return config;
    },
  ]);
};
