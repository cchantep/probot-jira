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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
var _this = this;
var Option_1 = require("fp-ts/lib/Option");
var either = __importStar(require("fp-ts/lib/Either"));
var t = __importStar(require("io-ts"));
var util_1 = require("./util");
var c = __importStar(require("./config"));
var jira = __importStar(require("./jira/integration"));
var j = __importStar(require("./jira/client"));
var pullrequest_1 = require("./model/pullrequest");
var StatusContext = 'pr-jira';
var IssueInfo = t.exact(t.type({
    id: t.number,
    number: t.number,
    pull_request: t.union([t.any, t.undefined, t.null]),
}));
function scheduledRepoInfo(context) {
    try {
        return context.repo({});
    }
    catch (e) {
        context.log.debug('Default repository resolution fails', e);
    }
    // ---
    // As .repo(..) may not be allowed on 'schedule' event
    if (!process.env.GITHUB_REPOSITORY) {
        context.log.warn('Fails to resolve repository (no GITHUB_REPOSITORY)');
        return;
    }
    // ---
    var rd = process.env.GITHUB_REPOSITORY.split('/');
    if (rd.length != 2) {
        context.log.warn("Malformed GITHUB_REPOSITORY: " + process.env.GITHUB_REPOSITORY);
        return;
    }
    // ---
    return { owner: rd[0], repo: rd[1] };
}
function checkIsClosed(context, config, repoInfo, credentials, author, pr) {
    return withJiraIssue(context, pr, config, function (data) {
        var issue = data[0], url = data[1];
        var jiraStatus = issue.fields.status.name;
        if (config.postMergeStatus.find(function (s) { return s == jiraStatus; })) {
            return Promise.resolve(context.log("JIRA issue " + issue.key + " for pull request #" + pr.number + " is now " + jiraStatus));
        }
        else {
            var details = config.postMergeStatus.join(', ');
            var msg = "JIRA issue [" + issue.key + "](" + url + ") doesn't seem to have a valid status: '" + jiraStatus + "' !~ [" + details + "]";
            context.log(msg + " (pull request #" + pr.number + ")");
            return context.github.issues
                .createComment(__assign({}, repoInfo, { number: pr.number, body: "@" + author + " " + msg + ". Please check it." })).then(function (_r) { return Promise.resolve(); });
        }
    });
}
function withIssuePR(context, f) {
    return __awaiter(this, void 0, void 0, function () {
        var issue, event, resp;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    issue = context.payload.issue;
                    return [4 /*yield*/, util_1.fromEither(IssueInfo.decode(issue))];
                case 1:
                    event = _a.sent();
                    context.log.debug('Event', event);
                    if (!!event.pull_request) return [3 /*break*/, 2];
                    context.log("Not a pull request issue: #" + event.id);
                    return [3 /*break*/, 4];
                case 2: return [4 /*yield*/, context.github.pulls.get(context.repo({
                        pull_number: issue.number,
                    }))];
                case 3:
                    resp = _a.sent();
                    return [2 /*return*/, util_1.fromEither(pullrequest_1.PullRequestInfo.decode(resp.data)).then(f)];
                case 4: return [2 /*return*/];
            }
        });
    });
}
function mainHandler(context, pr) {
    return __awaiter(this, void 0, void 0, function () {
        var repo, config;
        var _this = this;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    repo = context.repo({});
                    return [4 /*yield*/, c.getConfig(context, repo, pr.base.ref)];
                case 1:
                    config = _a.sent();
                    return [2 /*return*/, withJiraIssue(context, pr, config, function (data) { return __awaiter(_this, void 0, void 0, function () {
                            var issue, url;
                            return __generator(this, function (_a) {
                                issue = data[0], url = data[1];
                                checkMilestone(context, config, pr, issue, url);
                                return [2 /*return*/];
                            });
                        }); })];
            }
        });
    });
}
function checkMilestone(context, config, pr, issue, issueUrl) {
    return __awaiter(this, void 0, void 0, function () {
        var milestone, found, details, description;
        return __generator(this, function (_a) {
            if (!pr.milestone) {
                return [2 /*return*/, context.log("Pull request #" + pr.number + " is not milestoned: skip version consistency check for JIRA issue " + issue.key)];
            }
            milestone = pr.milestone;
            context.log.debug('Issue fixVersions', issue.fields.fixVersions);
            found = issue.fields.fixVersions.findIndex(function (v) {
                var vm = v.name.match(config.fixVersionRegex);
                if (!vm || vm.length < 2) {
                    context.log("Fix version " + v.name + " doesn't match: " + config.fixVersionRegex);
                    return false;
                }
                else {
                    return vm[1] == milestone.title;
                }
            });
            if (found >= 0) {
                return [2 /*return*/, toggleState(context, StatusContext, pr.head.sha, 'success', "Consistent with JIRA issue " + issue.key, Option_1.some(issueUrl))];
            }
            else {
                details = issue.fields.fixVersions.length == 0 ? '<none>' : issue.fields.fixVersions.map(function (v) { return v.name; }).join(', ');
                context.log("No JIRA fixVersion for issue '" + issue.key + "' is matching the milestone '" + milestone.title + "' of pull request #" + pr.number + ": " + details);
                description = ("Milestone doesn't correspond to JIRA fixVersions for " + issue.key + ": " + details).substring(0, 140);
                return [2 /*return*/, toggleState(context, StatusContext, pr.head.sha, 'error', description, Option_1.some(issueUrl))];
            }
            return [2 /*return*/];
        });
    });
}
function withJiraIssue(context, pr, config, f) {
    return __awaiter(this, void 0, void 0, function () {
        var repoInfo, issueKey;
        var _this = this;
        return __generator(this, function (_a) {
            repoInfo = context.repo({});
            context.log.debug('Config', config);
            issueKey = jiraIssueKey(context, config, pr);
            context.log.debug('Issue key', issueKey);
            either.fold(function (msg) {
                context.log("Pull request #" + pr.number + " $msg");
                return toggleState(context, StatusContext, pr.head.sha, 'success', msg, Option_1.none);
            }, function (k) { return __awaiter(_this, void 0, void 0, function () {
                var credentials, jiraIssue;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0: return [4 /*yield*/, jira.credentials(repoInfo.owner, repoInfo.repo)];
                        case 1:
                            credentials = _a.sent();
                            context.log.debug('Credentials', credentials);
                            return [4 /*yield*/, j.getIssue(credentials, k).then(function (res) {
                                    return either.fromOption(function () { return "No JIRA issue '" + k + "'"; })(res);
                                })];
                        case 2:
                            jiraIssue = _a.sent();
                            context.log.debug('jiraIssue', jiraIssue);
                            return [2 /*return*/, either.fold(function (msg) {
                                    context.log(msg + " corresponding to pull request #" + pr.number);
                                    return toggleState(context, StatusContext, pr.head.sha, 'error', msg, Option_1.none);
                                }, function (issue) {
                                    var issueUrl = "https://" + credentials.domain + "/browse/" + issue.key;
                                    return f([issue, issueUrl]);
                                })(jiraIssue)];
                    }
                });
            }); })(issueKey);
            return [2 /*return*/];
        });
    });
}
// ---
function jiraIssueKey(context, config, pr) {
    var m = pr.title.match(config.issueKeyRegex);
    if (!m || m.length < 2) {
        var msg = "doesn't match issue expression (" + config.issueKeyRegex + ")";
        context.log.debug("Title of pull request #" + pr.number + " " + msg + ": " + pr.title);
        return either.left(msg);
    }
    else {
        return either.right(m[1]);
    }
}
var isSuccessful = Option_1.exists(function (s) { return s.state != 'success'; });
function toggleState(bot, statusContext, sha, expectedState, msg, url) {
    return getCommitStatus(bot, sha, statusContext).then(function (st) {
        var mustSet = expectedState == 'success'
            ? isSuccessful(st)
            : !Option_1.exists(function (s) { return s.state == expectedState && s.description == msg; })(st);
        if (!mustSet) {
            return Promise.resolve();
        }
        else {
            return bot.github.repos
                .createStatus(bot.repo({
                sha: sha,
                context: statusContext,
                state: expectedState,
                description: msg,
                target_url: Option_1.toUndefined(url),
            }))
                .then(function (_r) { return Promise.resolve(); });
        }
    });
}
function getCommitStatus(bot, ref, ctx) {
    return bot.github.repos.listStatusesForRef(bot.repo({ ref: ref })).then(function (resp) {
        var found = resp.data.find(function (s) { return s.context == ctx; });
        if (!found) {
            return Promise.resolve(Option_1.none);
        }
        else {
            return Promise.resolve(Option_1.some(found));
        }
    });
}
module.exports = function (app) {
    app.on(['pull_request.opened', 'pull_request.edited', 'pull_request.synchronize', 'pull_request.reopened'], function (context) { return __awaiter(_this, void 0, void 0, function () {
        var event, pr;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, util_1.fromEither(pullrequest_1.PullRequestEvent.decode(context.payload))];
                case 1:
                    event = _a.sent();
                    context.log.debug('Event', event);
                    pr = event.pull_request;
                    return [2 /*return*/, mainHandler(context, pr)];
            }
        });
    }); });
    app.on('pull_request.closed', function (context) { return __awaiter(_this, void 0, void 0, function () {
        var event, prNumber, repoInfo, pr, config, credentials;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    event = context.payload.pull_request;
                    prNumber = event.number;
                    if (!event.merged_at) {
                        return [2 /*return*/, context.log("Pull request #" + prNumber + " is closed without merge")];
                    }
                    // ---
                    context.log("Pull request #" + prNumber + " is merged at " + event.merged_at);
                    repoInfo = context.repo({});
                    return [4 /*yield*/, context.github.pulls
                            .get(__assign({}, repoInfo, { pull_number: prNumber }))
                            .then(function (resp) { return util_1.fromEither(pullrequest_1.PullRequestInfo.decode(resp.data)); })];
                case 1:
                    pr = _a.sent();
                    return [4 /*yield*/, c.getConfig(context, repoInfo, pr.base.ref)];
                case 2:
                    config = _a.sent();
                    return [4 /*yield*/, jira.credentials(repoInfo.owner, repoInfo.repo)];
                case 3:
                    credentials = _a.sent();
                    return [2 /*return*/, checkIsClosed(context, config, repoInfo, credentials, event.user.login, pr)];
            }
        });
    }); });
    app.on('issues.milestoned', function (context) {
        return withIssuePR(context, function (pr) { return mainHandler(context, pr); });
    });
    app.on('issues.demilestoned', function (context) {
        return withIssuePR(context, function (pr) {
            var repo = context.repo({});
            return c.getConfig(context, repo, pr.base.ref).then(function (config) {
                return withJiraIssue(context, pr, config, function (data) {
                    var issue = data[0], url = data[1];
                    var msg = "Milestone expected to check with JIRA issue " + issue.key;
                    return toggleState(context, StatusContext, pr.head.sha, 'failure', msg, Option_1.some(url));
                });
            });
        });
    });
    app.on('repository_dispatch', function (context) { return __awaiter(_this, void 0, void 0, function () {
        // TODO: config
        function find(items) {
            return __awaiter(this, void 0, void 0, function () {
                var pr, config, issueKey;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (items.length < 1) {
                                return [2 /*return*/, Promise.resolve(undefined)];
                            }
                            pr = items[0];
                            return [4 /*yield*/, c.getConfig(context, repoInfo, pr.base.ref)];
                        case 1:
                            config = _a.sent();
                            issueKey = jiraIssueKey(context, config, pr);
                            context.log.debug("Check pull request #" + pr.number + " against issue " + jiraIssueId, issueKey);
                            if (!either.exists(function (k) { return k == issue.key; })(issueKey)) {
                                return [2 /*return*/, find(items.slice(1))];
                            }
                            // ---
                            return [2 /*return*/, util_1.fromEither(pullrequest_1.PullRequestInfo.decode(pr)).then(function (r) { return [r, config]; })];
                    }
                });
            });
        }
        var i, jiraIssueId, repoInfo, credentials, jiraIssue, _a, issue, resp, result, prInfo, config, issueUrl;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    i = context.payload.action.indexOf('@');
                    if (i == -1) {
                        context.log('Invalid action', context.payload.action);
                        return [2 /*return*/];
                    }
                    jiraIssueId = context.payload.action.substring(i + 1);
                    repoInfo = context.repo({});
                    context.log('JIRA issue event', { jiraIssueId: jiraIssueId, repo: repoInfo });
                    return [4 /*yield*/, jira.credentials(repoInfo.owner, repoInfo.repo)];
                case 1:
                    credentials = _b.sent();
                    _a = Option_1.toUndefined;
                    return [4 /*yield*/, j.getIssue(credentials, jiraIssueId)];
                case 2:
                    jiraIssue = _a.apply(void 0, [_b.sent()]);
                    if (!jiraIssue) {
                        context.log("No JIRA found: " + jiraIssueId);
                        return [2 /*return*/];
                    }
                    issue = jiraIssue;
                    context.log.debug('JIRA issue', issue);
                    return [4 /*yield*/, context.github.pulls.list(__assign({}, repoInfo, { state: 'open' }))
                        // TODO: config
                    ];
                case 3:
                    resp = _b.sent();
                    return [4 /*yield*/, find(resp.data)];
                case 4:
                    result = _b.sent();
                    if (!result) {
                        return [2 /*return*/, context.log("No open pull request matching the updated JIRA issue " + issue.key)];
                    }
                    prInfo = result[0];
                    config = result[1];
                    context.log('Matching pull request', prInfo);
                    issueUrl = "https://" + credentials.domain + "/browse/" + issue.key;
                    checkMilestone(context, config, prInfo, issue, issueUrl);
                    return [2 /*return*/];
            }
        });
    }); });
    app.on('schedule', function (context) { return __awaiter(_this, void 0, void 0, function () {
        function check(items) {
            return __awaiter(this, void 0, void 0, function () {
                var pr, config;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            if (items.length == 0) {
                                return [2 /*return*/, context.log.debug('End periodic check', repoInfo)];
                            }
                            return [4 /*yield*/, util_1.fromEither(pullrequest_1.PullRequestInfo.decode(items[0]))];
                        case 1:
                            pr = _a.sent();
                            return [4 /*yield*/, c.getConfig(context, repoInfo, pr.base.ref)];
                        case 2:
                            config = _a.sent();
                            context.log('Closed PR', pr);
                            return [2 /*return*/, checkIsClosed(context, config, repoInfo, credentials, pr.user.login, pr)
                                    .then(function (_r) { return check(items.slice(1)); })];
                    }
                });
            });
        }
        var r, repoInfo, resp, merged, credentials;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    r = scheduledRepoInfo(context);
                    if (!r) {
                        return [2 /*return*/, context.log.error('Cannot perform period check without repository')];
                    }
                    repoInfo = r;
                    context.log('Periodic check', repoInfo);
                    return [4 /*yield*/, context.github.pulls.list(__assign({}, repoInfo, { state: 'closed', sort: 'updated', direction: 'desc', per_page: 50 }))];
                case 1:
                    resp = _a.sent();
                    merged = resp.data.filter(function (i) { return !!i.merged_at; });
                    return [4 /*yield*/, jira.credentials(repoInfo.owner, repoInfo.repo)];
                case 2:
                    credentials = _a.sent();
                    check(merged);
                    return [2 /*return*/];
            }
        });
    }); });
    app.on("*", function (context) { return __awaiter(_this, void 0, void 0, function () {
        var r, repoInfo;
        return __generator(this, function (_a) {
            r = scheduledRepoInfo(context);
            if (!r) {
                return [2 /*return*/, context.log.error('Cannot perform period check without repository')];
            }
            repoInfo = r;
            context.log.debug('Checking JIRA hook', { repo: repoInfo });
            jira.ensureHook({
                repo: repoInfo,
                github: context.github,
                log: context.log,
            });
            return [2 /*return*/];
        });
    }); });
};
//# sourceMappingURL=index.js.map