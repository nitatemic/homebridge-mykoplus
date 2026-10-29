"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLUGIN_NAME = exports.PLATFORM_NAME = exports.MykoPlusPlatform = void 0;
const settings_1 = require("./settings");
Object.defineProperty(exports, "PLATFORM_NAME", { enumerable: true, get: function () { return settings_1.PLATFORM_NAME; } });
Object.defineProperty(exports, "PLUGIN_NAME", { enumerable: true, get: function () { return settings_1.PLUGIN_NAME; } });
const platform_1 = require("./platform");
Object.defineProperty(exports, "MykoPlusPlatform", { enumerable: true, get: function () { return platform_1.MykoPlusPlatform; } });
exports.default = (api) => {
    api.registerPlatform(settings_1.PLATFORM_NAME, platform_1.MykoPlusPlatform);
};
//# sourceMappingURL=index.js.map