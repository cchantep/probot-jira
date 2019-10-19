"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var Either_1 = require("fp-ts/lib/Either");
function fromEither(e) {
    return Either_1.fold(function (cause) { return Promise.reject(new Error(JSON.stringify(cause))); }, function (res) { return Promise.resolve(res); })(e);
}
exports.fromEither = fromEither;
//# sourceMappingURL=util.js.map