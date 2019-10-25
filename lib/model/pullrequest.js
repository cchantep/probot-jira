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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PullRequestLabelEvent = exports.PullRequestEvent = exports.PullRequestInfo = exports.Label = exports.UserInfo = void 0;
var t = __importStar(require("io-ts"));
exports.UserInfo = t.exact(t.type({
    login: t.string,
}));
var BranchInfo = t.exact(t.type({
    label: t.string,
    ref: t.string,
    sha: t.string,
}));
exports.Label = t.exact(t.type({
    name: t.string,
}));
var MilestoneInfo = t.exact(t.type({
    url: t.string,
    title: t.string,
    description: t.string
}));
exports.PullRequestInfo = t.exact(t.type({
    number: t.number,
    html_url: t.string,
    state: t.string,
    title: t.string,
    user: exports.UserInfo,
    base: BranchInfo,
    head: BranchInfo,
    labels: t.array(exports.Label),
    milestone: t.union([MilestoneInfo, t.null])
}));
// --- Events
var RepoInfo = t.exact(t.type({
    id: t.number,
    name: t.string,
    owner: exports.UserInfo,
}));
var prEventBase = {
    pull_request: exports.PullRequestInfo,
    repository: RepoInfo,
    sender: exports.UserInfo
};
exports.PullRequestEvent = t.exact(t.type(prEventBase));
exports.PullRequestLabelEvent = t.exact(t.type(__assign(__assign({}, prEventBase), { label: exports.Label })));
//# sourceMappingURL=pullrequest.js.map