"use strict";
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
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