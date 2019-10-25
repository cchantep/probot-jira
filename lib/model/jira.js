"use strict";
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
exports.Hook = exports.HookSettings = exports.Issue = void 0;
var t = __importStar(require("io-ts"));
var Version = t.exact(t.type({
    id: t.string,
    description: t.union([t.string, t.undefined, t.null]),
    name: t.string
}));
var IssueStatus = t.exact(t.type({
    name: t.string
}));
var IssueResolution = t.exact(t.type({
    name: t.string
}));
exports.Issue = t.exact(t.type({
    id: t.string,
    key: t.string,
    fields: t.exact(t.type({
        fixVersions: t.array(Version),
        resolution: t.union([IssueResolution, t.undefined, t.null]),
        status: IssueStatus,
        summary: t.string,
        description: t.union([t.string, t.undefined, t.null])
    }))
}));
// ---
var HookFilter = t.exact(t.type({
    'issue-related-events-section': t.union([t.string, t.undefined])
}));
var HookProps = t.type({
    name: t.string,
    url: t.string,
    enabled: t.boolean,
    events: t.array(t.string),
    filters: t.union([HookFilter, t.undefined, t.null]),
});
exports.HookSettings = t.exact(HookProps);
exports.Hook = t.exact(t.intersection([HookProps, t.type({
        self: t.string
    })]));
// ---
//# sourceMappingURL=jira.js.map