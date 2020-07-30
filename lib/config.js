"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getConfig = exports.DefaultConfig = exports.Config = void 0;
var t = __importStar(require("io-ts"));
var util = __importStar(require("./util"));
// ---
var content_1 = require("./model/content");
function getContent(bot, repo, path, ref) {
    return bot.github.repos
        .getContents(__assign(__assign({}, repo), { path: path, ref: ref }))
        .then(function (payload) { return util.fromEither(content_1.GetContentResponse.decode(payload)); });
}
// ---
var pr_jira_json_1 = __importDefault(require("./resources/pr-jira.json"));
exports.Config = t.exact(t.type({
    issueKeyRegex: t.string,
    milestoneRegex: t.union([t.string, t.undefined]),
    fixVersionRegex: t.string,
    postMergeStatus: t.array(t.string),
    githubDispatchBaseUrl: t.union([t.string, t.undefined]),
}));
exports.DefaultConfig = pr_jira_json_1.default;
// ---
function getFromJson(bot, repo, path, ref) {
    return getContent(bot, repo, path, ref).then(function (resp) {
        var buff = Buffer.from(resp.data.content, resp.data.encoding);
        return JSON.parse(buff.toString('utf8'));
    });
}
function getConfig(bot, repo, ref) {
    return getFromJson(bot, repo, '.github/pr-jira.json', ref)
        .then(function (json) { return util.fromEither(exports.Config.decode(json)); })
        .then(function (decoded) { return decoded; }, function (err) {
        bot.log.debug("Fails to load configuration from branch '" + ref + "'", err);
        return exports.DefaultConfig;
    });
}
exports.getConfig = getConfig;
//# sourceMappingURL=config.js.map