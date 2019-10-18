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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (Object.hasOwnProperty.call(mod, k)) result[k] = mod[k];
    result["default"] = mod;
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
var j = __importStar(require("./client"));
function ensureHook(ctx) {
    return __awaiter(this, void 0, void 0, function () {
        var repoInfo, logger, prefix, creds, hooks, name, appHook, jiraProject, ghTok, ghUser, webhookUrl, newHook;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    repoInfo = ctx.repo;
                    logger = ctx.log;
                    prefix = (repoInfo.owner + "_" + repoInfo.repo).toUpperCase();
                    return [4 /*yield*/, credentials(repoInfo.owner, repoInfo.repo)];
                case 1:
                    creds = _a.sent();
                    return [4 /*yield*/, j.getHooks(creds)];
                case 2:
                    hooks = _a.sent();
                    name = "github-pr-jira-" + prefix;
                    appHook = hooks.find(function (h) { return h.name == name; });
                    if (!!appHook) {
                        logger("JIRA hook already exists for " + prefix);
                        return [2 /*return*/, Promise.resolve(ctx.repo)];
                    }
                    jiraProject = process.env[prefix + "_JIRA_PROJECT_NAME"] || process.env.JIRA_PROJECT_NAME;
                    logger.debug('jiraProject', jiraProject);
                    ghTok = process.env.GITHUB_TOKEN;
                    if (!ghTok) {
                        return [2 /*return*/, Promise.reject(new Error('Missing GITHUB_TOKEN'))];
                    }
                    ghUser = process.env.GH_USER;
                    if (!ghUser) {
                        return [2 /*return*/, Promise.reject(new Error('Missing GH_USER'))];
                    }
                    webhookUrl = "https://gh-redispatch.herokuapp.com/jira/" + repoInfo.owner + "/" + repoInfo.repo + "?user=" + ghUser + "&pass=" + ghTok;
                    newHook = {
                        name: name,
                        url: webhookUrl,
                        enabled: true,
                        events: ['jira:issue_updated', 'jira:issue_deleted'],
                        filters: {
                            'issue-related-events-section': "project = \"" + jiraProject + "\"",
                        },
                    };
                    logger('Registering JIRA hook ...', newHook);
                    return [2 /*return*/, j.registerHook(creds, newHook).then(function (_r) { return ctx.repo; })];
            }
        });
    });
}
exports.ensureHook = ensureHook;
function credentials(owner, repo) {
    var prefix = (owner + "_" + repo).toUpperCase();
    var domain = process.env[prefix + "_JIRA_DOMAIN"] || process.env.JIRA_DOMAIN;
    if (!domain) {
        return Promise.reject(new Error("Missing JIRA domain: " + domain));
    }
    var username = process.env[prefix + "_JIRA_USER"] || process.env.JIRA_USER;
    if (!username) {
        return Promise.reject(new Error('Missing JIRA user'));
    }
    var apiToken = process.env[prefix + "_JIRA_API_TOKEN"] || process.env.JIRA_API_TOKEN;
    if (!apiToken) {
        return Promise.reject(new Error('Missing JIRA API token'));
    }
    return Promise.resolve({ domain: domain, username: username, apiToken: apiToken });
}
exports.credentials = credentials;
/*
  // TODO
  jiraRoutes.post('/hook*', async (req: any, res: any) => {
    app.log('Request', req.query)

    const param: string | undefined = req.query['installation_id']

    if (!param) {
      app.log('Invalid parameter on JIRA hook', param)
      return res.sendStatus(400)
    }

    const installId: number = parseInt(param, 10)

    if (isNaN(installId)) {
      app.log('Invalid installation ID on JIRA hook', installId)
      return res.sendStatus(400)
    }

    // ---

    app.log(`Received request on JIRA hook for installation ${installId}`)

    const issueEvent = await fromEither(IssueCallback.decode(req.body))

    app.log('issueEvent', issueEvent)

    await app.auth(installId).then(authed => {
      authed.apps.listRepos({}).then(r => {
        app.log('REPOS', r.data.repositories)

        res.end('Hello')
      })
    })
  })

*/
//# sourceMappingURL=integration.js.map