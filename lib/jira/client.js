"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var Option_1 = require("fp-ts/lib/Option");
var Either_1 = require("fp-ts/lib/Either");
var t = __importStar(require("io-ts"));
var axios_1 = __importDefault(require("axios"));
var util_1 = require("../util");
var jira_1 = require("../model/jira");
function getIssue(credentials, key) {
    var domain = credentials.domain, username = credentials.username, apiToken = credentials.apiToken;
    return axios_1.default({
        method: 'get',
        url: "https://" + encodeURIComponent(username) + ":" + apiToken + "@" + domain + "/rest/api/latest/issue/" + key,
    }).then(function (resp) {
        return resp.status != 200 ? Promise.resolve(Option_1.none) : util_1.fromEither(jira_1.Issue.decode(resp.data)).then(function (issue) { return Option_1.some(issue); });
    }, function (err) {
        if (err.response.status == 404) {
            return Promise.resolve(Option_1.none);
        }
        else {
            return Promise.reject(err);
        }
    });
}
exports.getIssue = getIssue;
var Hooks = t.array(jira_1.Hook);
function getHooks(credentials) {
    var domain = credentials.domain, username = credentials.username, apiToken = credentials.apiToken;
    return axios_1.default({
        method: 'get',
        url: "https://" + encodeURIComponent(username) + ":" + apiToken + "@" + domain + "/rest/webhooks/latest/webhook",
    }).then(function (resp) { return (resp.status != 200 ? Promise.resolve([]) : util_1.fromEither(Hooks.decode(resp.data))); }, function (err) {
        if (err.response.status == 404) {
            return Promise.resolve([]);
        }
        else {
            return Promise.reject(err);
        }
    });
}
exports.getHooks = getHooks;
function getHook(credentials, id) {
    var domain = credentials.domain, username = credentials.username, apiToken = credentials.apiToken;
    return axios_1.default({
        method: 'get',
        url: "https://" + encodeURIComponent(username) + ":" + apiToken + "@" + domain + "/rest/webhooks/latest/webhook/" + id,
    }).then(function (resp) {
        return resp.status != 200 ? Promise.resolve(Option_1.none) : util_1.fromEither(jira_1.Hook.decode(resp.data)).then(function (issue) { return Option_1.some(issue); });
    }, function (err) { return (err.response.status == 404 ? Promise.resolve(Option_1.none) : Promise.reject(err)); });
}
exports.getHook = getHook;
function registerHook(credentials, hook) {
    var domain = credentials.domain, username = credentials.username, apiToken = credentials.apiToken;
    return axios_1.default
        .post("https://" + encodeURIComponent(username) + ":" + apiToken + "@" + domain + "/rest/webhooks/latest/webhook/", jira_1.HookSettings.encode(hook))
        .then(function (resp) {
        return resp.status != 200
            ? Promise.resolve(Either_1.left("Unexpected status: " + resp.status))
            : Promise.resolve(Either_1.right(void 0));
    }, function (err) { return Promise.reject(err); });
}
exports.registerHook = registerHook;
//# sourceMappingURL=client.js.map