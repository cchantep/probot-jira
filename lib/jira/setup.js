"use strict";
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
var _this = this;
Object.defineProperty(exports, "__esModule", { value: true });
var webhook_proxy_1 = require("probot/lib/webhook-proxy");
exports.setup = function (app) {
    // Installation registry cache
    var installations = {};
    installations[881510] = [
        {
            owner: 'cchantep',
            repo: 'mal',
        },
    ];
    setupRouting(app);
    webhookUrl(app.log)
        .then(function (jiraHookUrl) {
        return app
            .auth()
            .then(function (api) {
            return api.apps.listInstallations({}).then(function (r) {
                return r.data.forEach(function (i) {
                    return app
                        .auth(i.id)
                        .then(function (a) {
                        return onInstallation({
                            logger: app.log,
                            github: a,
                            id: i.id.toString(),
                            webhookUrl: jiraHookUrl,
                        });
                    })
                        .then(function (repos) {
                        installations[i.id] = repos;
                        return void 0;
                    });
                });
            });
        })
            .then(function (_r) { return jiraHookUrl; });
    })
        .then(function (jiraHookUrl) {
        return app.on('installation.created', function (context) { return __awaiter(_this, void 0, void 0, function () {
            var repos, created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, context.github.apps.listRepos({})];
                    case 1:
                        repos = _a.sent();
                        created = context.payload.installation;
                        return [4 /*yield*/, onInstallation({
                                logger: context.log,
                                github: context.github,
                                id: created.id,
                                webhookUrl: jiraHookUrl,
                            }).then(function (repos) {
                                installations[created.id] = repos;
                                return void 0;
                            })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        }); });
    });
    app.on('installation.deleted', function (context) { return __awaiter(_this, void 0, void 0, function () {
        var deleted, repos;
        var _this = this;
        return __generator(this, function (_a) {
            deleted = context.payload.installation;
            context.log("Installation " + deleted.id + " deleted");
            repos = installations[deleted.id];
            if (!repos) {
                return [2 /*return*/, context.log("No repostory found for deleted installation " + deleted.id)];
            }
            // ---
            repos.forEach(function (r) { return __awaiter(_this, void 0, void 0, function () {
                var owner, repo, credentials, hooks, installedHook;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            owner = r.owner, repo = r.repo;
                            context.log("Cleaning JIRA hooks for repository '" + owner + "/" + repo + "'");
                            return [4 /*yield*/, jiraCredentials(owner, repo)];
                        case 1:
                            credentials = _a.sent();
                            return [4 /*yield*/, j.getHooks(credentials)];
                        case 2:
                            hooks = _a.sent();
                            context.log.debug('JIRA hooks', hooks);
                            installedHook = hooks.find(function (h) { return h.name == "pr-jira-" + deleted.id; });
                            if (!installedHook) {
                                return [2 /*return*/, context.log("No JIRA hook is matching installation " + deleted.id + " for repository '" + owner + "/" + repo + "'")];
                            }
                            // ---
                            context.log("JIRA hook found for deleted installation " + deleted.id, installedHook);
                            return [4 /*yield*/, j.unregisterHook(credentials, installedHook.self)];
                        case 3: return [2 /*return*/, _a.sent()];
                    }
                });
            }); });
            delete installations[deleted.id];
            return [2 /*return*/];
        });
    }); });
};
function setupRouting(app) {
    return __awaiter(this, void 0, void 0, function () {
        var jiraRoutes, express;
        var _this = this;
        return __generator(this, function (_a) {
            jiraRoutes = app.route('/jira');
            express = require('express');
            jiraRoutes.use(express.json());
            // TODO
            jiraRoutes.post('/hook*', function (req, res) { return __awaiter(_this, void 0, void 0, function () {
                var param, installId, issueEvent;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            app.log('Request', req.query);
                            param = req.query['installation_id'];
                            if (!param) {
                                app.log('Invalid parameter on JIRA hook', param);
                                return [2 /*return*/, res.sendStatus(400)];
                            }
                            installId = parseInt(param, 10);
                            if (isNaN(installId)) {
                                app.log('Invalid installation ID on JIRA hook', installId);
                                return [2 /*return*/, res.sendStatus(400)];
                            }
                            // ---
                            app.log("Received request on JIRA hook for installation " + installId);
                            return [4 /*yield*/, fromEither(IssueCallback.decode(req.body))];
                        case 1:
                            issueEvent = _a.sent();
                            app.log('issueEvent', issueEvent);
                            return [4 /*yield*/, app.auth(installId).then(function (authed) {
                                    authed.apps.listRepos({}).then(function (r) {
                                        app.log('REPOS', r.data.repositories);
                                        res.end('Hello');
                                    });
                                })];
                        case 2:
                            _a.sent();
                            return [2 /*return*/];
                    }
                });
            }); });
            return [2 /*return*/];
        });
    });
}
function webhookUrl(logger) {
    return __awaiter(this, void 0, void 0, function () {
        var smeeKey, createJiraChannel, jiraHookUrl, port;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    smeeKey = 'JIRA_WEBHOOK_PROXY_URL';
                    createJiraChannel = function () {
                        logger('Setup smee.io channel for JIRA webhook');
                        var smee = require('smee-client');
                        return smee.createChannel().then(function (res) {
                            var url = res.toString();
                            logger("Save " + url + " in .env as " + smeeKey);
                            return url;
                        });
                    };
                    return [4 /*yield*/, Promise.resolve(process.env[smeeKey]).then(function (configured) { return configured || createJiraChannel(); })];
                case 1:
                    jiraHookUrl = _a.sent();
                    if (jiraHookUrl.substring(0, 15) == 'https://smee.io') {
                        logger("Create webhook proxy for JIRA/smee.io channel of " + jiraHookUrl);
                        port = parseInt(process.env['PORT'] || '3000', 10);
                        webhook_proxy_1.createWebhookProxy({
                            logger: logger,
                            port: port,
                            path: '/jira/hook',
                            url: jiraHookUrl,
                        });
                    }
                    return [2 /*return*/, jiraHookUrl];
            }
        });
    });
}
function onInstallation(ctx) {
    var _this = this;
    var logger = ctx.logger, id = ctx.id, github = ctx.github, webhookUrl = ctx.webhookUrl;
    var go = function (input, out) { return __awaiter(_this, void 0, void 0, function () {
        var repoInfo, tail, prefix, credentials, hooks, name, appHook, jiraProject, newHook;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (input.length == 0) {
                        return [2 /*return*/, Promise.resolve(out)];
                    }
                    repoInfo = input[0];
                    tail = input.slice(1);
                    prefix = (repoInfo.owner + "_" + repoInfo.repo).toUpperCase();
                    return [4 /*yield*/, jiraCredentials(repoInfo.owner, repoInfo.repo)];
                case 1:
                    credentials = _a.sent();
                    return [4 /*yield*/, j.getHooks(credentials)];
                case 2:
                    hooks = _a.sent();
                    name = "pr-jira-" + id;
                    appHook = hooks.find(function (h) { return h.name == name; });
                    if (!!appHook) {
                        logger("JIRA hook already exists for installation " + id);
                        return [2 /*return*/, go(tail, out)];
                    }
                    jiraProject = process.env[prefix + "_JIRA_PROJECT_NAME"] || process.env['JIRA_PROJECT_NAME'];
                    logger.debug('jiraProject', jiraProject);
                    newHook = {
                        name: name,
                        url: webhookUrl,
                        enabled: true,
                        events: ['jira:issue_updated', 'jira:issue_deleted'],
                        filters: {
                            'issue-related-events-section': "project = \"" + jiraProject + "\"",
                        },
                    };
                    logger('Register JIRA hook', newHook);
                    return [2 /*return*/, j.registerHook(credentials, newHook).then(function (_r) { return go(tail, out.concat(repoInfo)); })];
            }
        });
    }); };
    return github.apps.listRepos({}).then(function (r) {
        return go(r.data.repositories.map(function (repo) {
            var repoInfo = {
                owner: repo.owner.login,
                repo: repo.name,
            };
            return repoInfo;
        }), []);
    });
}
//# sourceMappingURL=setup.js.map